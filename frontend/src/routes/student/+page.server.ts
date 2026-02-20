import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities, participations, organizations, users } from '$lib/server/db';
import { eq, desc, count, and, gte, lte, sql } from 'drizzle-orm';

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
				name: activities.title, // Map title to name for component compatibility
				title: activities.title,
				description: activities.description,
				start_date: activities.startDate,
				end_date: activities.endDate,
				start_time_only: activities.startTimeOnly,
				end_time_only: activities.endTimeOnly,
				activity_type: activities.activityType,
				location: activities.location,
				max_participants: activities.maxParticipants,
				status: activities.status,
				created_at: activities.created_at,
				hours: activities.hours
			})
			.from(activities)
			.where(eq(activities.status, 'ongoing'))
			.orderBy(desc(activities.created_at))
			.limit(5);

		// Transform data to include participant_count count
		recentActivities = await Promise.all(
			result.map(async (activity: any) => {
				const [participantCount] = await db
					.select({ count: count() })
					.from(participations)
					.where(
						and(eq(participations.activityId, activity.id), eq(participations.status, 'completed'))
					);

				return {
					...activity,
					participant_count: participantCount?.count || 0
				};
			})
		);
	} catch (error) {
		console.warn('Failed to load recent activities:', error);
	}

	// Load participation history for the user
	let participationHistory: any[] = [];
	try {
		const historyResult = await db
			.select({
				id: participations.id,
				participated_at: participations.registeredAt,
				checked_in_at: participations.checkedInAt,
				checked_out_at: participations.checkedOutAt,
				status: participations.status,
				notes: participations.notes,
				activity: {
					id: activities.id,
					name: activities.title,
					title: activities.title,
					description: activities.description,
					location: activities.location,
					start_date: activities.startDate,
					end_date: activities.endDate,
					activity_type: activities.activityType
				}
			})
			.from(participations)
			.leftJoin(activities, eq(participations.activityId, activities.id))
			.where(eq(participations.userId, user.user_id))
			.orderBy(desc(participations.registeredAt))
			.limit(5);

		participationHistory = historyResult;
	} catch (error) {
		console.warn('Failed to load participation history:', error);
	}

	// Calculate real statistics
	let stats = {
		totalParticipations: 0,
		thisMonthParticipations: 0,
		upcomingActivities: 0
	};

	try {
		// Total participations
		const [totalCount] = await db
			.select({ count: count() })
			.from(participations)
			.where(and(eq(participations.userId, user.user_id), eq(participations.status, 'completed')));

		// This month participations
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);

		const endOfMonth = new Date();
		endOfMonth.setMonth(endOfMonth.getMonth() + 1);
		endOfMonth.setDate(0);
		endOfMonth.setHours(23, 59, 59, 999);

		const [monthlyCount] = await db
			.select({ count: count() })
			.from(participations)
			.where(
				and(
					eq(participations.userId, user.user_id),
					eq(participations.status, 'completed'),
					gte(participations.registeredAt, startOfMonth),
					lte(participations.registeredAt, endOfMonth)
				)
			);

		// Upcoming activities count (next 7 days)
		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 7);

		const [upcomingCount] = await db
			.select({ count: count() })
			.from(activities)
			.where(
				and(
					eq(activities.status, 'ongoing'),
					gte(activities.startDate, today.toISOString().split('T')[0]),
					lte(activities.startDate, nextWeek.toISOString().split('T')[0])
				)
			);

		stats = {
			totalParticipations: totalCount?.count || 0,
			thisMonthParticipations: monthlyCount?.count || 0,
			upcomingActivities: upcomingCount?.count || 0
		};
	} catch (error) {
		console.warn('Failed to calculate statistics:', error);
	}

	return {
		user,
		recentActivities,
		participationHistory,
		stats
	};
};
