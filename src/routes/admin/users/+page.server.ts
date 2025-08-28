import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { 
    User, 
    UserFilter, 
    UserStats,
    Faculty
} from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, faculties, departments } from '$lib/server/db';
import { eq, and, or, like, desc, count, sql, gte } from 'drizzle-orm';

/**
 * Get users from database with filters and pagination
 */
async function getUsersFromDb(adminLevel: string, facultyId: string | null | undefined, filters: UserFilter, offset: number, limit: number) {
    let query = db
        .select({
            id: users.id,
            email: users.email,
            prefix: users.prefix,
            first_name: users.firstName,
            last_name: users.lastName,
            student_id: users.studentId,
            department_id: users.departmentId,
            status: users.status,
            created_at: users.createdAt,
            updated_at: users.updatedAt,
            department_name: departments.name,
            faculty_id: departments.facultyId,
            faculty_name: faculties.name,
            admin_level: adminRoles.adminLevel,
            admin_faculty_id: adminRoles.facultyId,
            is_admin: sql<boolean>`${adminRoles.id} IS NOT NULL`,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .leftJoin(faculties, eq(departments.facultyId, faculties.id))
        .leftJoin(adminRoles, eq(users.id, adminRoles.userId))
        .$dynamic();

    const conditions = [];

    // Faculty filtering for FacultyAdmin
    if (adminLevel === AdminLevel.FacultyAdmin && facultyId) {
        conditions.push(eq(departments.facultyId, facultyId));
    }

    // Apply filters
    if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(or(
            like(users.firstName, searchTerm),
            like(users.lastName, searchTerm),
            like(users.email, searchTerm),
            like(users.studentId, searchTerm)
        ));
    }

    if (filters.faculty_id) {
        conditions.push(eq(departments.facultyId, filters.faculty_id));
    }

    if (filters.department_id) {
        conditions.push(eq(users.departmentId, filters.department_id));
    }

    // Status filter - map UI status to database enum
    if (filters.status && filters.status !== 'all') {
        let dbStatus: 'active' | 'inactive' | 'suspended';
        switch (filters.status) {
            case 'online':
                dbStatus = 'active';
                break;
            case 'offline':
                dbStatus = 'inactive';
                break;
            case 'disabled':
                dbStatus = 'suspended';
                break;
            default:
                dbStatus = filters.status as 'active' | 'inactive' | 'suspended';
        }
        conditions.push(eq(users.status, dbStatus));
    }

    // Apply conditions
    if (conditions.length > 0) {
        query = query.where(and(...conditions));
    }

    // Add ordering and pagination
    const result = await query.orderBy(desc(users.createdAt)).offset(offset).limit(limit);

    // Get total count for pagination
    let countQuery = db.select({ count: count() }).from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .$dynamic();
    
    if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
    }

    const totalResult = await countQuery;
    const totalCount = totalResult[0]?.count || 0;

    return { users: result, totalCount };
}

/**
 * Get user statistics from database
 */
async function getUserStatsFromDb(adminLevel: string, facultyId: string | null | undefined): Promise<UserStats> {
    // Base conditions for faculty filtering
    const baseConditions = [];
    if (adminLevel === AdminLevel.FacultyAdmin && facultyId) {
        baseConditions.push(eq(departments.facultyId, facultyId));
    }

    const [totalUsers, activeUsers, recentRegistrations] = await Promise.all([
        // Total users
        (() => {
            let q = db.select({ count: count() }).from(users).$dynamic();
            if (baseConditions.length > 0) {
                q = q.leftJoin(departments, eq(users.departmentId, departments.id));
                return q.where(and(...baseConditions));
            }
            return q;
        })(),
        
        // Active users (users with status 'active')
        (() => {
            let q = db.select({ count: count() }).from(users).$dynamic();
            const activeConditions = [eq(users.status, 'active'), ...baseConditions];
            if (baseConditions.length > 0) {
                q = q.leftJoin(departments, eq(users.departmentId, departments.id));
            }
            return q.where(and(...activeConditions));
        })(),
        
        // Recent registrations (last 30 days)
        (() => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            let q = db.select({ count: count() }).from(users).$dynamic();
            const recentConditions = [
                gte(users.createdAt, thirtyDaysAgo),
                ...baseConditions
            ];
            
            if (baseConditions.length > 0) {
                q = q.leftJoin(departments, eq(users.departmentId, departments.id));
            }
            return q.where(and(...recentConditions));
        })()
    ]);

    const total = totalUsers[0]?.count || 0;
    const active = activeUsers[0]?.count || 0;
    const recent = recentRegistrations[0]?.count || 0;

    return {
        total_users: total,
        active_users: active,
        inactive_users: Math.max(0, total - active),
        students: total, // Assuming most users are students
        faculty: 0,
        staff: 0,
        recent_registrations: recent
    };
}

/**
 * Get faculties from database
 */
async function getFacultiesFromDb(): Promise<Faculty[]> {
    const result = await db
        .select({
            id: faculties.id,
            name: faculties.name,
            code: faculties.code,
            description: faculties.description,
            status: faculties.status,
            created_at: faculties.createdAt,
            updated_at: faculties.updatedAt
        })
        .from(faculties)
        .where(eq(faculties.status, true))
        .orderBy(faculties.name);

    return result.map(f => ({
        ...f,
        description: f.description || undefined, // Convert null to undefined
        created_at: f.created_at?.toISOString() || new Date().toISOString(),
        updated_at: f.updated_at?.toISOString() || new Date().toISOString()
    }));
}

/**
 * Server Load Function for General User Management
 * Implements role-based access control:
 * - SuperAdmin: Can view all users system-wide
 * - FacultyAdmin: Can only view users within their faculty
 */
export const load: PageServerLoad = async (event) => {
    // Ensure user is authenticated as admin
    const user = requireAdmin(event);
    const adminLevel = user.admin_role?.admin_level;
    const facultyId = user.admin_role?.faculty_id;

    // Extract query parameters for filtering and pagination
    const url = event.url;
    const searchParams = url.searchParams;
    
    const filters: UserFilter = {
        search: searchParams.get('search') || undefined,
        faculty_id: searchParams.get('faculty_id') || undefined,
        department_id: searchParams.get('department_id') || undefined,
        status: (searchParams.get('status') as any) || 'all',
        role: (searchParams.get('role') as any) || 'all',
        created_after: searchParams.get('created_after') || undefined,
        created_before: searchParams.get('created_before') || undefined
    };

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    try {
        // Validate admin access
        if (adminLevel === AdminLevel.FacultyAdmin && !facultyId) {
            throw error(403, 'Faculty admin must be associated with a faculty');
        }

        if (adminLevel !== AdminLevel.SuperAdmin && adminLevel !== AdminLevel.FacultyAdmin) {
            throw error(403, 'Insufficient permissions to view user data');
        }

        // Direct database queries instead of API calls
        const [usersData, statsData, facultiesData] = await Promise.all([
            getUsersFromDb(adminLevel, facultyId, filters, offset, limit),
            getUserStatsFromDb(adminLevel, facultyId),
            // Load faculties for filtering (only for SuperAdmin)
            adminLevel === AdminLevel.SuperAdmin ? getFacultiesFromDb() : Promise.resolve([])
        ]);

        // Process faculties data
        const faculties: Faculty[] = facultiesData;

        // Create a faculty lookup map for better performance
        const facultyMap = new Map();
        faculties.forEach(f => facultyMap.set(f.id, f));

        // Process users data
        const { users: rawUsers, totalCount } = usersData;
        let users: User[] = [];
        let pagination = { page: page, total_pages: Math.max(1, Math.ceil(totalCount / limit)), total_count: totalCount, limit: limit } as any;

        users = rawUsers.map((u: any) => {
            // Map database status to User status
            let status: User['status'];
            switch (u.status) {
                case 'active':
                    status = 'online';
                    break;
                case 'inactive':
                    status = 'offline';
                    break;
                case 'suspended':
                    status = 'disabled';
                    break;
                default:
                    status = 'offline';
            }

            const department = u.department_name ? { id: u.department_id, name: u.department_name } : undefined;
            
            // Handle faculty data
            let faculty = null;
            if (u.is_admin && u.admin_faculty_id) {
                // For admin users, use admin's faculty
                const facultyFromMap = facultyMap.get(u.admin_faculty_id);
                faculty = facultyFromMap || { id: u.admin_faculty_id, name: 'Unknown Faculty' };
            } else if (u.faculty_name && u.faculty_id) {
                // For regular users, use department's faculty
                faculty = { id: u.faculty_id, name: u.faculty_name };
            }

            // Determine user role based on admin_level
            let role: User['role'] = 'student'; // default
            
            if (u.is_admin && u.admin_level) {
                switch (u.admin_level) {
                    case 'super_admin':
                        role = 'super_admin';
                        break;
                    case 'faculty_admin':
                        role = 'faculty_admin';
                        break;
                    case 'regular_admin':
                        role = 'regular_admin';
                        break;
                    default:
                        role = 'admin';
                }
            }
            return {
                id: u.id,
                email: u.email,
                prefix: u.prefix || 'Generic',
                first_name: u.first_name,
                last_name: u.last_name,
                student_id: u.student_id,
                employee_id: undefined, // Not in database schema yet
                department_id: u.department_id,
                faculty_id: u.faculty_id,
                status,
                role,
                phone: undefined, // Not in database schema yet
                avatar: undefined, // Not in database schema yet
                last_login: undefined, // TODO: Add last login tracking
                email_verified_at: undefined, // Not in database schema yet
                created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
                updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
                department,
                faculty,
            } as User;
        });

        // Process stats data
        const stats: UserStats = statsData;

        return {
            users,
            stats,
            faculties,
            pagination,
            filters,
            adminLevel,
            facultyId,
            canManageAllUsers: adminLevel === AdminLevel.SuperAdmin
        };

    } catch (err) {
        console.error('Error in users page load:', err);
        throw error(500, 'Failed to load user data');
    }
};
