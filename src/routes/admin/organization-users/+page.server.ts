import { requireAdmin } from '$lib/server/auth-utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserFilter, UserStats, Organization, Department } from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, organizations, departments } from '$lib/server/db';
import { eq, and, or, like, desc, count, sql, gte } from 'drizzle-orm';

/**
 * Get users from database with filters and pagination (Organization-scoped)
 */
async function getUsersFromDb(
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

	// Organization filtering (this page shows organization-scoped users)
	if (organizationId) {
		conditions.push(eq(departments.organizationId, organizationId));
	}

	// Apply search filters
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
 * Get user statistics from database (Faculty-scoped)
 */
async function getUserStatsFromDb(organizationId: string | null | undefined): Promise<UserStats> {
	// Base query for organization-scoped users
	const baseConditions = organizationId ? [eq(departments.organizationId, organizationId)] : [];

	const [totalUsers, activeUsers, recentRegistrations] = await Promise.all([
		// Total users in organization
		(() => {
			let q = db
				.select({ count: count() })
				.from(users)
				.leftJoin(departments, eq(users.departmentId, departments.id))
				.$dynamic();
			return baseConditions.length > 0 ? q.where(and(...baseConditions)) : q;
		})(),

		// Active users in organization
		(() => {
			let q = db
				.select({ count: count() })
				.from(users)
				.leftJoin(departments, eq(users.departmentId, departments.id))
				.$dynamic();
			const conds = [
				eq(users.status, 'active'),
				...(baseConditions.length > 0 ? baseConditions : [])
			];
			return q.where(and(...conds));
		})(),

		// Recent registrations (last 30 days) in organization
		(() => {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const recentConditions = [gte(users.createdAt, thirtyDaysAgo), ...baseConditions];

			let q = db
				.select({ count: count() })
				.from(users)
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
 * Get organizations from database
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

	return result.map((f) => ({
		...f,
		description: f.description || undefined, // Convert null to undefined
		created_at: f.created_at?.toISOString() || new Date().toISOString(),
		updated_at: f.updated_at?.toISOString() || new Date().toISOString()
	}));
}

/**
 * Get departments for a specific organization
 */
async function getDepartmentsFromDb(organizationId: string): Promise<Department[]> {
	const result = await db
		.select({
			id: departments.id,
			name: departments.name,
			code: departments.code,
			organization_id: departments.organizationId,
			description: departments.description,
			status: departments.status,
			created_at: departments.createdAt,
			updated_at: departments.updatedAt
		})
		.from(departments)
		.where(and(eq(departments.organizationId, organizationId), eq(departments.status, true)))
		.orderBy(departments.name);

	return result.map((d) => ({
		...d,
		description: d.description || undefined, // Convert null to undefined
		created_at: d.created_at?.toISOString() || new Date().toISOString(),
		updated_at: d.updated_at?.toISOString() || new Date().toISOString()
	}));
}

/**
 * Server Load Function for Faculty-Scoped User Management
 * Implements role-based access control:
 * - SuperAdmin: Can view all users system-wide with optional organization filtering
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
		// Determine which organization to filter by
		let targetOrganizationId: string | undefined;

		if (adminLevel === AdminLevel.OrganizationAdmin) {
			// OrganizationAdmin can only see their organization
			if (!organizationId) {
				throw error(403, 'Organization admin must be associated with an organization');
			}
			targetOrganizationId = organizationId;
		} else if (adminLevel === AdminLevel.SuperAdmin) {
			// SuperAdmin can filter by organization or see all
			targetOrganizationId = (filters as any).organization_id || undefined;
		} else {
			throw error(403, 'Insufficient permissions to view user data');
		}

		// Load data concurrently
		const [usersData, statsData, organizationsData, departmentsData] = await Promise.all([
			getUsersFromDb(targetOrganizationId, filters, offset, limit),
			getUserStatsFromDb(targetOrganizationId),
			// Load organizations for filtering (only for SuperAdmin)
			adminLevel === AdminLevel.SuperAdmin ? getOrganizationsFromDb() : Promise.resolve([]),
			// Load departments for the target organization
			targetOrganizationId ? getDepartmentsFromDb(targetOrganizationId) : Promise.resolve([])
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

			const department = u.department_name
				? {
						id: u.department_id,
						name: u.department_name
					}
				: undefined;

			// Handle organization data
			let organization = null as any;
			if (u.is_admin && u.admin_organization_id) {
				const orgFromList = (organizationsData as Organization[]).find(
					(f) => f.id === u.admin_organization_id
				);
				organization = orgFromList || { id: u.admin_organization_id, name: 'Unknown Organization' };
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
				first_name: u.first_name,
				last_name: u.last_name,
				student_id: u.student_id,
				employee_id: undefined,
				department_id: u.department_id,
				organization_id: u.organization_id,
				status,
				role,
				phone: undefined,
				avatar: undefined,
				last_login: undefined,
				email_verified_at: undefined,
				created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
				updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
				department,
				organization
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
			organizations: organizationsData,
			departments: departmentsData,
			pagination,
			filters,
			adminLevel,
			organizationId: targetOrganizationId,
			canManageAllUsers: adminLevel === AdminLevel.SuperAdmin
		};
	} catch (err) {
		console.error('Error in organization-users page load:', err);
		throw error(500, 'Failed to load user data');
	}
};
