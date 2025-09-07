import { requireAdmin } from '$lib/server/auth-utils';
import type { PageServerLoad } from './$types';
import type { AdminDashboardStats } from '$lib/types/admin';
import { db, users, activities, participations, adminRoles, departments } from '$lib/server/db';
import { eq, and, count, desc, sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);

	// โหลดสถิติแดชบอร์ด
	let stats: AdminDashboardStats = {
		total_users: 0,
		total_activities: 0,
		total_participations: 0,
		active_sessions: 0,
		ongoing_activities: 0,
		user_registrations_today: 0,
		recent_activities: [],
		// Organization specific stats
		organization_users: 0,
		departments_count: 0,
		active_users: 0,
		new_users_this_month: 0,
		department_breakdown: []
	};

	try {
		const isOrgAdmin = user.admin_role?.admin_level === 'OrganizationAdmin';
		const adminOrgId = (user.admin_role as any)?.organization_id;

		if (isOrgAdmin && adminOrgId) {
			// Organization Admin specific queries - use departments to find users
			const [orgUsers, departmentsCount, activeUsers, newUsersMonth, departmentBreakdown] =
				await Promise.all([
					// Count users in this organization through departments
					db
						.select({ count: count(users.id) })
						.from(users)
						.innerJoin(departments, eq(users.departmentId, departments.id))
						.where(eq(departments.organizationId, adminOrgId)),
					// Count departments in this organization
					db
						.select({ count: count() })
						.from(departments)
						.where(eq(departments.organizationId, adminOrgId)),
					// Active users (using a simpler approach since we don't have lastLogin)
					db
						.select({ count: count(users.id) })
						.from(users)
						.innerJoin(departments, eq(users.departmentId, departments.id))
						.where(and(eq(departments.organizationId, adminOrgId), eq(users.status, 'active'))),
					// New users this month
					db
						.select({ count: count(users.id) })
						.from(users)
						.innerJoin(departments, eq(users.departmentId, departments.id))
						.where(
							and(
								eq(departments.organizationId, adminOrgId),
								sql`DATE_TRUNC('month', ${users.createdAt}) = DATE_TRUNC('month', CURRENT_DATE)`
							)
						),
					// Department breakdown
					db
						.select({
							id: departments.id,
							name: departments.name,
							user_count: count(users.id)
						})
						.from(departments)
						.leftJoin(users, eq(users.departmentId, departments.id))
						.where(eq(departments.organizationId, adminOrgId))
						.groupBy(departments.id, departments.name)
				]);

			stats = {
				...stats,
				organization_users: orgUsers[0]?.count || 0,
				departments_count: departmentsCount[0]?.count || 0,
				active_users: activeUsers[0]?.count || 0,
				new_users_this_month: newUsersMonth[0]?.count || 0,
				department_breakdown: departmentBreakdown || []
			};
		} else {
			// SuperAdmin queries - system-wide stats
			const [
				totalUsers,
				totalActivities,
				totalParticipations,
				activeSessions,
				ongoingActivities,
				todayRegistrations
			] = await Promise.all([
				db.select({ count: count() }).from(users),
				db.select({ count: count() }).from(activities),
				db.select({ count: count() }).from(participations),
				db.select({ count: count() }).from(adminRoles).where(eq(adminRoles.isEnabled, true)),
				db.select({ count: count() }).from(activities).where(eq(activities.status, 'ongoing')),
				db
					.select({ count: count() })
					.from(users)
					.where(sql`DATE(${users.createdAt}) = CURRENT_DATE`)
			]);

			stats = {
				...stats,
				total_users: totalUsers[0]?.count || 0,
				total_activities: totalActivities[0]?.count || 0,
				total_participations: totalParticipations[0]?.count || 0,
				active_sessions: activeSessions[0]?.count || 0,
				ongoing_activities: ongoingActivities[0]?.count || 0,
				user_registrations_today: todayRegistrations[0]?.count || 0
			};
		}
	} catch (error) {
		console.warn('Failed to load dashboard stats:', error);
	}

	// โหลดกิจกรรมล่าสุด (optional)
	let recentActivities: any[] = [];
	try {
		const isOrgAdmin = user.admin_role?.admin_level === 'OrganizationAdmin';
		const adminOrgId = (user.admin_role as any)?.organization_id;

		let dbActivities;

		if (isOrgAdmin && adminOrgId) {
			// Filter activities for organization admin
			dbActivities = await db
				.select({
					id: activities.id,
					title: activities.title,
					description: activities.description,
					start_date: activities.startDate,
					end_date: activities.endDate,
					activity_type: activities.activityType,
					status: activities.status,
					created_at: activities.createdAt,
					action: sql<string>`'activity_created'`.as('action'),
					type: sql<string>`'success'`.as('type'),
					user_name: sql<string>`NULL`.as('user_name'),
					department_name: sql<string>`NULL`.as('department_name'),
					faculty_name: sql<string>`NULL`.as('faculty_name')
				})
				.from(activities)
				.where(
					sql`${activities.eligibleOrganizations}::jsonb @> ${JSON.stringify([adminOrgId])}::jsonb OR ${activities.activityLevel} = 'university'`
				)
				.orderBy(desc(activities.createdAt))
				.limit(10);
		} else {
			// Super admin gets all activities
			dbActivities = await db
				.select({
					id: activities.id,
					title: activities.title,
					description: activities.description,
					start_date: activities.startDate,
					end_date: activities.endDate,
					activity_type: activities.activityType,
					status: activities.status,
					created_at: activities.createdAt,
					action: sql<string>`'activity_created'`.as('action'),
					type: sql<string>`'success'`.as('type'),
					user_name: sql<string>`NULL`.as('user_name'),
					department_name: sql<string>`NULL`.as('department_name'),
					faculty_name: sql<string>`NULL`.as('faculty_name')
				})
				.from(activities)
				.orderBy(desc(activities.createdAt))
				.limit(10);
		}

		recentActivities = dbActivities.map((activity) => ({
			...activity,
			title: activity.title || 'กิจกรรมใหม่',
			description: activity.description || activity.title || 'มีกิจกรรมใหม่ในระบบ'
		}));
	} catch (error) {
		console.warn('Failed to load recent activities:', error);
	}

	return {
		user,
		admin_role: user.admin_role,
		stats,
		recentActivities,
		organization: undefined // Will be set in layout if needed
	};
};
