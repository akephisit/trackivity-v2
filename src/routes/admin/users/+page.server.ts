import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserFilter, UserStats, Organization } from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, organizations, departments } from '$lib/server/db';
import { eq, and, desc, count, sql, gte } from 'drizzle-orm';

/**
 * Get users from database with filters and pagination
 */
async function getUsersFromDb(
	adminLevel: string,
	organizationId: string | null | undefined,
	filters: UserFilter,
	offset: number,
	limit: number
) {
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
			last_login_at: users.lastLoginAt,
			login_count: users.loginCount,
			created_at: users.created_at,
			updated_at: users.updated_at,
			department_name: departments.name,
			organization_id: departments.organizationId,
			organization_name: organizations.name,
			admin_level: adminRoles.adminLevel,
			admin_organization_id: adminRoles.organizationId,
			is_admin: sql<boolean>`${adminRoles.id} IS NOT NULL`
		})
		.from(users)
		.leftJoin(departments, eq(users.departmentId, departments.id))
		.leftJoin(organizations, eq(departments.organizationId, organizations.id))
		.leftJoin(adminRoles, eq(users.id, adminRoles.userId))
		.$dynamic();

	const conditions = [];
	
	// Filter out soft deleted users
	conditions.push(sql`${users.deletedAt} IS NULL`);

	// Organization filtering for OrganizationAdmin
	if (adminLevel === AdminLevel.OrganizationAdmin && organizationId) {
		conditions.push(eq(departments.organizationId, organizationId));
	}

	// Apply filters - use optimized full-text search for Thai text
	if (filters.search) {
		// For full-text search, we'll use a direct SQL query that utilizes the new search function
		conditions.push(
			sql`(
				to_tsvector('thai', ${users.firstName} || ' ' || ${users.lastName}) @@ plainto_tsquery('thai', ${filters.search})
				OR ${users.studentId} ILIKE ${`%${filters.search}%`}
				OR ${users.email} ILIKE ${`%${filters.search}%`}
			)`
		);
	}

	if (filters.organization_id) {
		conditions.push(eq(departments.organizationId, (filters as any).organization_id));
	}

	if (filters.department_id) {
		conditions.push(eq(users.departmentId, filters.department_id));
	}

	// Status filter - use database values directly
	if (filters.status && filters.status !== 'all') {
		conditions.push(eq(users.status, filters.status));
	}

	// Apply conditions
	if (conditions.length > 0) {
		query = query.where(and(...conditions));
	}

	// Add ordering and pagination
	const result = await query.orderBy(desc(users.created_at)).offset(offset).limit(limit);

	// Get total count for pagination
	let countQuery = db
		.select({ count: count() })
		.from(users)
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
async function getUserStatsFromDb(
	adminLevel: string,
	organizationId: string | null | undefined
): Promise<UserStats> {
	// Base conditions for faculty filtering
	const baseConditions: any[] = [];
	if (adminLevel === AdminLevel.OrganizationAdmin && organizationId) {
		baseConditions.push(eq(departments.organizationId, organizationId));
	}

	const [totalUsers, activeUsers, recentRegistrations] = await Promise.all([
		// Total users (excluding soft deleted)
		(() => {
			let q = db.select({ count: count() }).from(users).$dynamic();
			const totalConditions = [sql`${users.deletedAt} IS NULL`, ...baseConditions];
			if (baseConditions.length > 0) {
				q = q.leftJoin(departments, eq(users.departmentId, departments.id));
			}
			return q.where(and(...totalConditions));
		})(),

		// Active users (users with status 'active' and not soft deleted)
		(() => {
			let q = db.select({ count: count() }).from(users).$dynamic();
			const activeConditions = [eq(users.status, 'active'), sql`${users.deletedAt} IS NULL`, ...baseConditions];
			if (baseConditions.length > 0) {
				q = q.leftJoin(departments, eq(users.departmentId, departments.id));
			}
			return q.where(and(...activeConditions));
		})(),

		// Recent registrations (last 30 days, excluding soft deleted)
		(() => {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			let q = db.select({ count: count() }).from(users).$dynamic();
			const recentConditions = [
				gte(users.created_at, thirtyDaysAgo), 
				sql`${users.deletedAt} IS NULL`, 
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
async function getOrganizationsFromDb(): Promise<Organization[]> {
	const result = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			code: organizations.code,
			description: organizations.description,
			status: organizations.status,
			created_at: organizations.created_at,
			updated_at: organizations.updated_at
		})
		.from(organizations)
		.where(eq(organizations.status, true))
		.orderBy(organizations.name);

	return result.map((o) => ({
		...o,
		description: o.description || undefined, // Convert null to undefined
		created_at: o.created_at?.toISOString() || new Date().toISOString(),
		updated_at: o.updated_at?.toISOString() || new Date().toISOString()
	}));
}

/**
 * Server Load Function for General User Management
 * Implements role-based access control:
 * - SuperAdmin: Can view all users system-wide
 * - OrganizationAdmin: Can only view users within their organization
 */
export const load: PageServerLoad = async (event) => {
	// Ensure user is authenticated as admin
	const user = requireAdmin(event);
	const adminLevel = user.admin_role?.admin_level;
	const organizationId = (user.admin_role as any)?.organization_id;

	// Extract query parameters for filtering and pagination
	const url = event.url;
	const searchParams = url.searchParams;

	const filters: UserFilter = {
		search: searchParams.get('search') || undefined,
		organization_id: searchParams.get('organization_id') || undefined,
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
		if (adminLevel === AdminLevel.OrganizationAdmin && !organizationId) {
			throw error(403, 'Organization admin must be associated with an organization');
		}

		if (adminLevel !== AdminLevel.SuperAdmin && adminLevel !== AdminLevel.OrganizationAdmin) {
			throw error(403, 'Insufficient permissions to view user data');
		}

		// Direct database queries instead of API calls
		const [usersData, statsData, organizationsData] = await Promise.all([
			getUsersFromDb(adminLevel, organizationId, filters, offset, limit),
			getUserStatsFromDb(adminLevel, organizationId),
			// Load organizations for filtering (only for SuperAdmin)
			adminLevel === AdminLevel.SuperAdmin ? getOrganizationsFromDb() : Promise.resolve([])
		]);

		// Process organizations data
		const orgs: Organization[] = organizationsData;
		const orgMap = new Map();
		orgs.forEach((o) => orgMap.set(o.id, o));

		// Process users data
		const { users: rawUsers, totalCount } = usersData;
		let users: User[] = [];
		let pagination = {
			page: page,
			total_pages: Math.max(1, Math.ceil(totalCount / limit)),
			total_count: totalCount,
			limit: limit
		} as any;

		users = rawUsers.map((u: any) => {
			// Use database status directly
			const status = u.status || 'inactive';

			const department = u.department_name
				? { id: u.department_id, name: u.department_name }
				: undefined;

			// Handle organization data
			let organization: { id: string; name: string } | undefined = undefined;
			if (u.is_admin && u.admin_organization_id) {
				const orgFromMap = orgMap.get(u.admin_organization_id);
				organization = orgFromMap || { id: u.admin_organization_id, name: 'Unknown Organization' };
			} else if (u.organization_name && u.organization_id) {
				organization = { id: u.organization_id, name: u.organization_name };
			}

			// Determine user role based on admin_level  
			const role = u.is_admin && u.admin_level ? u.admin_level : 'student';

			return {
				id: u.id,
				email: u.email,
				prefix: u.prefix,
				first_name: u.first_name,
				last_name: u.last_name,
				student_id: u.student_id,
				department_id: u.department_id,
				organization_id: u.organization_id,
				status,
				role,
				last_login_at: u.last_login_at,
				login_count: u.login_count || 0,
				created_at: u.created_at,
				updated_at: u.updated_at,
				department,
				organization
			};
		});

		// Process stats data
		const stats: UserStats = statsData;

		return {
			users,
			stats,
			organizations: orgs,
			pagination,
			filters,
			adminLevel,
			organizationId,
			canManageAllUsers: adminLevel === AdminLevel.SuperAdmin
		};
	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load user data');
	}
};
