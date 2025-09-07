import { getOptionalAuthUser } from '$lib/server/auth-utils';
import { db, activities, organizations, users } from '$lib/server/db';
import { eq, and, desc, or, gte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Try to get authenticated user (optional - won't redirect if not logged in)
	const user = getOptionalAuthUser(event);

	// Get current date for filtering
	const now = new Date();
	const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

	try {
		// Query for different types of activities with joins
		const [recentActivities, upcomingActivities, openRegistrationActivities, popularActivities] =
			await Promise.all([
				// Recent activities - newly created, published activities (last 30 days)
				db
					.select({
						id: activities.id,
						title: activities.title,
						description: activities.description,
						location: activities.location,
						activityType: activities.activityType,
						startDate: activities.startDate,
						endDate: activities.endDate,
						startTimeOnly: activities.startTimeOnly,
						endTimeOnly: activities.endTimeOnly,
						hours: activities.hours,
						maxParticipants: activities.maxParticipants,
						registrationOpen: activities.registrationOpen,
						status: activities.status,
						created_at: activities.created_at,
						updated_at: activities.updated_at,
						organizerName: organizations.name,
						organizerType: organizations.organizationType,
						creatorName: users.firstName
					})
					.from(activities)
					.innerJoin(organizations, eq(activities.organizerId, organizations.id))
					.innerJoin(users, eq(activities.createdBy, users.id))
					.where(
						and(
							eq(activities.status, 'published'),
							gte(activities.created_at, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
						)
					)
					.orderBy(desc(activities.created_at))
					.limit(6),

				// Upcoming activities - published activities starting in the future
				db
					.select({
						id: activities.id,
						title: activities.title,
						description: activities.description,
						location: activities.location,
						activityType: activities.activityType,
						startDate: activities.startDate,
						endDate: activities.endDate,
						startTimeOnly: activities.startTimeOnly,
						endTimeOnly: activities.endTimeOnly,
						hours: activities.hours,
						maxParticipants: activities.maxParticipants,
						registrationOpen: activities.registrationOpen,
						status: activities.status,
						created_at: activities.created_at,
						updated_at: activities.updated_at,
						organizerName: organizations.name,
						organizerType: organizations.organizationType,
						creatorName: users.firstName
					})
					.from(activities)
					.innerJoin(organizations, eq(activities.organizerId, organizations.id))
					.innerJoin(users, eq(activities.createdBy, users.id))
					.where(
						and(
							eq(activities.status, 'published'),
							gte(activities.startDate, today) // Starting from today or later
						)
					)
					.orderBy(activities.startDate)
					.limit(6),

				// Open for registration - published activities with registration open
				db
					.select({
						id: activities.id,
						title: activities.title,
						description: activities.description,
						location: activities.location,
						activityType: activities.activityType,
						startDate: activities.startDate,
						endDate: activities.endDate,
						startTimeOnly: activities.startTimeOnly,
						endTimeOnly: activities.endTimeOnly,
						hours: activities.hours,
						maxParticipants: activities.maxParticipants,
						registrationOpen: activities.registrationOpen,
						status: activities.status,
						created_at: activities.created_at,
						updated_at: activities.updated_at,
						organizerName: organizations.name,
						organizerType: organizations.organizationType,
						creatorName: users.firstName
					})
					.from(activities)
					.innerJoin(organizations, eq(activities.organizerId, organizations.id))
					.innerJoin(users, eq(activities.createdBy, users.id))
					.where(
						and(
							eq(activities.status, 'published'),
							eq(activities.registrationOpen, true),
							gte(activities.startDate, today) // Only future activities
						)
					)
					.orderBy(activities.startDate)
					.limit(6),

				// Popular activities - published activities (could be enhanced with participation count later)
				db
					.select({
						id: activities.id,
						title: activities.title,
						description: activities.description,
						location: activities.location,
						activityType: activities.activityType,
						startDate: activities.startDate,
						endDate: activities.endDate,
						startTimeOnly: activities.startTimeOnly,
						endTimeOnly: activities.endTimeOnly,
						hours: activities.hours,
						maxParticipants: activities.maxParticipants,
						registrationOpen: activities.registrationOpen,
						status: activities.status,
						created_at: activities.created_at,
						updated_at: activities.updated_at,
						organizerName: organizations.name,
						organizerType: organizations.organizationType,
						creatorName: users.firstName
					})
					.from(activities)
					.innerJoin(organizations, eq(activities.organizerId, organizations.id))
					.innerJoin(users, eq(activities.createdBy, users.id))
					.where(
						or(
							eq(activities.status, 'published'),
							eq(activities.status, 'ongoing'),
							eq(activities.status, 'completed')
						)
					)
					.orderBy(desc(activities.updated_at))
					.limit(6)
			]);

		return {
			user,
			activities: {
				recent: recentActivities,
				upcoming: upcomingActivities,
				openRegistration: openRegistrationActivities,
				popular: popularActivities
			}
		};
	} catch (error) {
		console.error('Error loading activities:', error);

		// Return user data with empty activities on error
		return {
			user,
			activities: {
				recent: [],
				upcoming: [],
				openRegistration: [],
				popular: []
			}
		};
	}
};
