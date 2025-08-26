import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { 
    User, 
    UserFilter, 
    UserListResponse, 
    UserStats,
    Faculty,
    Department
} from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, faculties, departments } from '$lib/server/db';
import { eq, and, or, like, desc, count, sql } from 'drizzle-orm';

/**
 * Get faculty users from database with filters and pagination
 */
async function getFacultyUsersFromDb(adminLevel: string, facultyId: string | null | undefined, filters: UserFilter, offset: number, limit: number) {
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
            department_code: departments.code,
            faculty_id: departments.facultyId,
            faculty_name: faculties.name,
            faculty_code: faculties.code,
            admin_level: adminRoles.adminLevel,
            admin_faculty_id: adminRoles.facultyId,
            is_admin: sql<boolean>`${adminRoles.id} IS NOT NULL`,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .leftJoin(faculties, eq(departments.facultyId, faculties.id))
        .leftJoin(adminRoles, eq(users.id, adminRoles.userId));

    const conditions = [];

    // Faculty filtering
    if (facultyId) {
        conditions.push(eq(departments.facultyId, facultyId));
    }

    // Apply other filters
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

    if (filters.status && filters.status !== 'all') {
        conditions.push(eq(users.status, filters.status));
    }

    if (conditions.length > 0) {
        query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(users.createdAt)).offset(offset).limit(limit);

    const result = await query;

    // Get total count for pagination
    let countQuery = db.select({ count: count() }).from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id));
    
    const countConditions = [...conditions];
    if (facultyId) {
        countConditions.push(eq(departments.facultyId, facultyId));
    }

    if (countConditions.length > 0) {
        countQuery = countQuery.where(and(...countConditions));
    }

    const totalResult = await countQuery;
    const totalCount = totalResult[0]?.count || 0;

    return { users: result, totalCount };
}

/**
 * Get faculty user statistics from database
 */
async function getFacultyUserStatsFromDb(adminLevel: string, facultyId: string | null | undefined): Promise<UserStats> {
    let baseQuery = db.select({ count: count() }).from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id));
    
    const conditions = [];
    if (facultyId) {
        conditions.push(eq(departments.facultyId, facultyId));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions));
    }

    const [totalUsers, activeUsers, recentRegistrations] = await Promise.all([
        // Total users
        baseQuery,
        
        // Active users
        (() => {
            let activeQuery = db.select({ count: count() }).from(users)
                .leftJoin(departments, eq(users.departmentId, departments.id))
                .where(eq(users.status, 'active'));
            if (facultyId) {
                activeQuery = activeQuery.where(and(
                    eq(users.status, 'active'), 
                    eq(departments.facultyId, facultyId)
                ));
            }
            return activeQuery;
        })(),
        
        // Recent registrations (last 30 days)
        (() => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            let recentQuery = db.select({ count: count() }).from(users)
                .leftJoin(departments, eq(users.departmentId, departments.id))
                .where(sql`${users.createdAt} >= ${thirtyDaysAgo}`);
                
            if (facultyId) {
                recentQuery = recentQuery.where(and(
                    sql`${users.createdAt} >= ${thirtyDaysAgo}`,
                    eq(departments.facultyId, facultyId)
                ));
            }
            return recentQuery;
        })()
    ]);

    const total = totalUsers[0]?.count || 0;
    const active = activeUsers[0]?.count || 0;
    const recent = recentRegistrations[0]?.count || 0;

    return {
        total_users: total,
        active_users: active,
        inactive_users: Math.max(0, total - active),
        students: total,
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

    return result;
}

/**
 * Get departments by faculty from database
 */
async function getDepartmentsByFacultyFromDb(facultyId: string): Promise<Department[]> {
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

    return result;
}

/**
 * Server Load Function for Faculty-Scoped User Management
 * Implements role-based access control:
 * - SuperAdmin: Can view all users system-wide with optional faculty filtering
 * - FacultyAdmin: Can only view users within their faculty
 */
export const load: PageServerLoad = async (event) => {
    // Ensure user is authenticated as admin
    const user = await requireAdmin(event);
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
        // Determine API endpoint based on admin level
        let apiEndpoint: string;
        // Stats endpoints defined in backend routes:
        //  - /api/admin/user-statistics (SuperAdmin, system-wide)
        //  - /api/admin/faculty-user-statistics?faculty_id=... (SuperAdmin or FacultyAdmin for scoped faculty)
        let statsPath: string;
        let statsParams: Record<string, string> | undefined;

        if (adminLevel === AdminLevel.SuperAdmin) {
            // SuperAdmin can view all users or filter by faculty
            apiEndpoint = filters.faculty_id 
                ? `/api/faculties/${filters.faculty_id}/users`
                : '/api/admin/system-users';
            if (filters.faculty_id) {
                statsPath = '/api/admin/faculty-user-statistics';
                statsParams = { faculty_id: filters.faculty_id };
            } else {
                statsPath = '/api/admin/user-statistics';
            }
        } else if (adminLevel === AdminLevel.FacultyAdmin && facultyId) {
            // FacultyAdmin is scoped to their faculty only
            apiEndpoint = `/api/faculties/${facultyId}/users`;
            statsPath = '/api/admin/faculty-user-statistics';
            statsParams = { faculty_id: facultyId };
            // Override any faculty_id filter to ensure scoping
            filters.faculty_id = facultyId;
        } else {
            error(403, 'Insufficient permissions to access user management');
        }

        // Build query parameters (backend expects limit/offset)
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== '' && v !== 'all') params.set(k, String(v));
        }

        // Convert params to object for API client
        const paramsObj: Record<string, string> = {};
        params.forEach((value, key) => {
            paramsObj[key] = value;
        });

        // Direct database queries instead of API calls
        const targetFacultyId = facultyId || filters.faculty_id;
        
        const [usersData, statsData, facultiesData, departmentsData] = await Promise.all([
            // Fetch users
            getFacultyUsersFromDb(adminLevel, targetFacultyId, filters, offset, limit),
            
            // Fetch statistics
            getFacultyUserStatsFromDb(adminLevel, targetFacultyId),

            // Fetch faculties for SuperAdmin filtering
            adminLevel === AdminLevel.SuperAdmin ? getFacultiesFromDb() : Promise.resolve([]),

            // Fetch departments for the relevant faculty
            targetFacultyId ? getDepartmentsByFacultyFromDb(targetFacultyId) : Promise.resolve([])
        ]);

        // Process database results
        const { users: rawUsers, totalCount } = usersData;
        const stats = statsData;
        const faculties = facultiesData;
        const departments = departmentsData;

        // Normalize users into a consistent shape expected by the table
        const normalizedUsers: User[] = rawUsers.map((u) => {
            // Map database status to display status
            const status: User['status'] = u.status === 'active' ? 'online' : 
                                         u.status === 'suspended' ? 'disabled' : 'offline';
            
            // Compose nested department/faculty for display
            const department: any = u.department_name
                ? { id: u.department_id, name: u.department_name, code: u.department_code }
                : undefined;
            const faculty: any = u.faculty_name
                ? { id: u.faculty_id, name: u.faculty_name, code: u.faculty_code }
                : undefined;

            const role: User['role'] = u.is_admin ? 
                (u.admin_level === 'super_admin' ? 'super_admin' :
                 u.admin_level === 'faculty_admin' ? 'faculty_admin' :
                 u.admin_level === 'regular_admin' ? 'regular_admin' : 'admin') : 'student';

            return {
                id: u.id,
                email: u.email,
                first_name: u.first_name,
                last_name: u.last_name,
                student_id: u.student_id,
                employee_id: undefined, // Not in current schema
                department_id: u.department_id,
                faculty_id: u.faculty_id,
                status,
                role,
                phone: undefined, // Not in current schema
                avatar: undefined, // Not in current schema
                last_login: undefined, // TODO: Add login tracking
                email_verified_at: undefined, // Not in current schema
                created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
                updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
                department,
                faculty,
            } as User;
        });

        // Use stats data directly from database query
        const normalizedStats: UserStats = stats;

        // Return data to the page component in unified format
        return {
            users: {
                users: normalizedUsers,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.max(1, Math.ceil(totalCount / limit)),
                },
                filters,
                total_count: totalCount,
            } satisfies UserListResponse,
            stats: normalizedStats,
            faculties,
            departments,
            filters,
            adminLevel,
            facultyId,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.max(1, Math.ceil(totalCount / limit)),
            },
            // Pass current user info for permission checking
            currentUser: user,
            // SEO and meta data
            meta: {
                title: adminLevel === AdminLevel.SuperAdmin 
                    ? 'ระบบจัดการผู้ใช้ทั้งหมด'
                    : 'จัดการผู้ใช้คณะ',
                description: adminLevel === AdminLevel.SuperAdmin
                    ? 'จัดการผู้ใช้ทั้งระบบพร้อมการกรองตามคณะ'
                    : 'จัดการข้อมูลผู้ใช้ในคณะของคุณ'
            }
        };

    } catch (err) {
        console.error('Error in faculty-users page load:', err);
        
        // Provide user-friendly error messages
        if (err instanceof Error) {
            if (err.message.includes('fetch')) {
                error(503, 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
            }
            if (err.message.includes('unauthorized') || err.message.includes('403')) {
                error(403, 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            }
        }
        
        error(500, 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
};
