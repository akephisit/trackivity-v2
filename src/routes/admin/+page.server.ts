import { requireAdmin } from '$lib/server/auth-utils';
import type { PageServerLoad } from './$types';
import type { AdminDashboardStats } from '$lib/types/admin';
import { db, users, activities, participations, adminRoles } from '$lib/server/db';
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
		recent_activities: []
	};

    try {
        // Direct database queries for dashboard stats
        const [totalUsers, totalActivities, totalParticipations, activeSessions, ongoingActivities, todayRegistrations] = await Promise.all([
            db.select({ count: count() }).from(users),
            db.select({ count: count() }).from(activities),
            db.select({ count: count() }).from(participations),
            db.select({ count: count() }).from(adminRoles).where(eq(adminRoles.isEnabled, true)),
            db.select({ count: count() }).from(activities).where(eq(activities.status, 'ongoing')),
            db.select({ count: count() }).from(users)
                .where(sql`DATE(${users.createdAt}) = CURRENT_DATE`)
        ]);

        stats = {
            total_users: totalUsers[0]?.count || 0,
            total_activities: totalActivities[0]?.count || 0,
            total_participations: totalParticipations[0]?.count || 0,
            active_sessions: activeSessions[0]?.count || 0,
            ongoing_activities: ongoingActivities[0]?.count || 0,
            user_registrations_today: todayRegistrations[0]?.count || 0,
            recent_activities: []
        };
    } catch (error) {
        console.warn('Failed to load dashboard stats:', error);
    }

	// โหลดกิจกรรมล่าสุด (optional)
	let recentActivities: any[] = [];
    try {
        // Load recent activities directly from database
        const dbActivities = await db
            .select({
                id: activities.id,
                title: activities.title,
                description: activities.description,
                start_date: activities.startDate,
                end_date: activities.endDate,
                activity_type: activities.activityType,
                status: activities.status,
                created_at: activities.createdAt
            })
            .from(activities)
            .orderBy(desc(activities.createdAt))
            .limit(10);

        recentActivities = dbActivities;
    } catch (error) {
        console.warn('Failed to load recent activities:', error);
    }

	return {
		user,
		stats,
		recentActivities
	};
};
