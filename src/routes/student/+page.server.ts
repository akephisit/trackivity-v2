import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { depends } = event;
	depends('student:dashboard');

	// Recent activities for dashboard - โหลดจากฐานข้อมูลโดยตรง
	let recentActivities: any[] = [];
	try {
		const result = await db
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
			.where(eq(activities.status, 'ongoing'))
			.orderBy(desc(activities.createdAt))
			.limit(5);

		recentActivities = result;
	} catch (error) {
		console.warn('Failed to load recent activities:', error);
	}

	// Placeholder until real endpoints exist
	const participationHistory: any[] = [];
	const stats = {
		totalParticipations: 0,
		thisMonthParticipations: 0,
		upcomingActivities: Array.isArray(recentActivities) ? recentActivities.length : 0
	};

	return {
		user,
		recentActivities,
		participationHistory,
		stats
	};
};
