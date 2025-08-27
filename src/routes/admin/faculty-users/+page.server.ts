import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { 
    User, 
    UserFilter, 
    UserStats,
    Faculty,
    Department
} from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, faculties, departments } from '$lib/server/db';
import { eq, and, or, like, desc, count, sql, gte } from 'drizzle-orm';

/**
 * Get users from database with filters and pagination (Faculty-scoped)
 */
async function getUsersFromDb(facultyId: string | null | undefined, filters: UserFilter, offset: number, limit: number) {
    let query = db
        .select({
            id: users.id,
            email: users.email,
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

    // Faculty filtering (this page shows faculty-scoped users)
    if (facultyId) {
        conditions.push(eq(departments.facultyId, facultyId));
    }

    // Apply search filters
    if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(or(
            like(users.firstName, searchTerm),
            like(users.lastName, searchTerm),
            like(users.email, searchTerm),
            like(users.studentId, searchTerm)
        ));
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
 * Get user statistics from database (Faculty-scoped)
 */
async function getUserStatsFromDb(facultyId: string | null | undefined): Promise<UserStats> {
    // Base query for faculty-scoped users
    const baseConditions = facultyId ? [eq(departments.facultyId, facultyId)] : [];
    
    const [totalUsers, activeUsers, recentRegistrations] = await Promise.all([
        // Total users in faculty
        (() => {
            let q = db.select({ count: count() }).from(users)
                .leftJoin(departments, eq(users.departmentId, departments.id))
                .$dynamic();
            return baseConditions.length > 0 ? q.where(and(...baseConditions)) : q;
        })(),
        
        // Active users in faculty
        (() => {
            let q = db.select({ count: count() }).from(users)
                .leftJoin(departments, eq(users.departmentId, departments.id))
                .$dynamic();
            const conds = [eq(users.status, 'active'), ...(baseConditions.length > 0 ? baseConditions : [])];
            return q.where(and(...conds));
        })(),
        
        // Recent registrations (last 30 days) in faculty
        (() => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentConditions = [
                gte(users.createdAt, thirtyDaysAgo),
                ...baseConditions
            ];
            
            let q = db.select({ count: count() }).from(users)
                .leftJoin(departments, eq(users.departmentId, departments.id))
                .$dynamic();
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
 * Get departments for a specific faculty
 */
async function getDepartmentsFromDb(facultyId: string): Promise<Department[]> {
    const result = await db
        .select({
            id: departments.id,
            name: departments.name,
            code: departments.code,
            faculty_id: departments.facultyId,
            description: departments.description,
            status: departments.status,
            created_at: departments.createdAt,
            updated_at: departments.updatedAt
        })
        .from(departments)
        .where(and(eq(departments.facultyId, facultyId), eq(departments.status, true)))
        .orderBy(departments.name);

    return result.map(d => ({
        ...d,
        description: d.description || undefined, // Convert null to undefined
        created_at: d.created_at?.toISOString() || new Date().toISOString(),
        updated_at: d.updated_at?.toISOString() || new Date().toISOString()
    }));
}

/**
 * Server Load Function for Faculty-Scoped User Management
 * Implements role-based access control:
 * - SuperAdmin: Can view all users system-wide with optional faculty filtering
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
        // Determine which faculty to filter by
        let targetFacultyId: string | undefined;
        
        if (adminLevel === AdminLevel.FacultyAdmin) {
            // FacultyAdmin can only see their faculty
            if (!facultyId) {
                throw error(403, 'Faculty admin must be associated with a faculty');
            }
            targetFacultyId = facultyId;
        } else if (adminLevel === AdminLevel.SuperAdmin) {
            // SuperAdmin can filter by faculty or see all
            targetFacultyId = filters.faculty_id || undefined;
        } else {
            throw error(403, 'Insufficient permissions to view user data');
        }

        // Load data concurrently
        const [usersData, statsData, facultiesData, departmentsData] = await Promise.all([
            getUsersFromDb(targetFacultyId, filters, offset, limit),
            getUserStatsFromDb(targetFacultyId),
            // Load faculties for filtering (only for SuperAdmin)
            adminLevel === AdminLevel.SuperAdmin ? getFacultiesFromDb() : Promise.resolve([]),
            // Load departments for the target faculty
            targetFacultyId ? getDepartmentsFromDb(targetFacultyId) : Promise.resolve([])
        ]);

        // Process users data
        const { users: rawUsers, totalCount } = usersData;
        const users: User[] = rawUsers.map((u: any) => {
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

            const department = u.department_name ? { 
                id: u.department_id, 
                name: u.department_name 
            } : undefined;
            
            // Handle faculty data
            let faculty = null;
            if (u.is_admin && u.admin_faculty_id) {
                const facultyFromList = facultiesData.find(f => f.id === u.admin_faculty_id);
                faculty = facultyFromList || { id: u.admin_faculty_id, name: 'Unknown Faculty' };
            } else if (u.faculty_name && u.faculty_id) {
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
                first_name: u.first_name,
                last_name: u.last_name,
                student_id: u.student_id,
                employee_id: undefined,
                department_id: u.department_id,
                faculty_id: u.faculty_id,
                status,
                role,
                phone: undefined,
                avatar: undefined,
                last_login: undefined,
                email_verified_at: undefined,
                created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
                updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
                department,
                faculty,
            } as User;
        });

        const pagination = {
            page,
            total_pages: Math.max(1, Math.ceil(totalCount / limit)),
            total_count: totalCount,
            limit
        };

        return {
            users,
            stats: statsData,
            faculties: facultiesData,
            departments: departmentsData,
            pagination,
            filters,
            adminLevel,
            facultyId: targetFacultyId,
            canManageAllUsers: adminLevel === AdminLevel.SuperAdmin
        };

    } catch (err) {
        console.error('Error in faculty-users page load:', err);
        throw error(500, 'Failed to load user data');
    }
};
