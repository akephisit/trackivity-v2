import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserFilter, UserStats, Organization } from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, organizations, departments } from '$lib/server/db';
import { eq, and, or, like, desc, count, sql, gte } from 'drizzle-orm';

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
			created_at: users.createdAt,
			updated_at: users.updatedAt,
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

	// Organization filtering for OrganizationAdmin
	if (adminLevel === AdminLevel.OrganizationAdmin && organizationId) {
		conditions.push(eq(departments.organizationId, organizationId));
	}

	// Apply filters
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				like(users.firstName, searchTerm),
				like(users.lastName, searchTerm),
				like(users.email, searchTerm),
				like(users.studentId, searchTerm)
			)
		);
	}

	if (filters.organization_id) {
		conditions.push(eq(departments.organizationId, (filters as any).organization_id));
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
			const recentConditions = [gte(users.createdAt, thirtyDaysAgo), ...baseConditions];

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
			created_at: organizations.createdAt,
			updated_at: organizations.updatedAt
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
			let role: User['role'] = 'student'; // default

			if (u.is_admin && u.admin_level) {
				switch (u.admin_level) {
					case 'super_admin':
						role = 'super_admin';
						break;
					case 'organization_admin':
						role = 'organization_admin';
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
				organization_id: u.organization_id,
				status,
				role,
				phone: undefined, // Not in database schema yet
				avatar: undefined, // Not in database schema yet
				last_login: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
				email_verified_at: undefined, // Not in database schema yet
				created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
				updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
				department,
				organization
			} as User;
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
