import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, activities, organizations, participations } from '$lib/server/db';
import { alias } from 'drizzle-orm/pg-core';
import { and, eq, or, sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);

	const searchParams = event.url.searchParams;
	const selectedActivityId = searchParams.get('activity_id') || undefined;

	// Build admin info block
	let facultyName: string | undefined = undefined;
	const facultyId = (user.admin_role as any)?.organization_id || undefined;
	if (facultyId) {
		try {
			const rows = await db
				.select({ id: organizations.id, name: organizations.name })
				.from(organizations)
				.where(eq(organizations.id, facultyId));
			facultyName = rows[0]?.name;
		} catch (e) {
			// Best effort only; keep facultyName undefined on error
			console.error('[qr-scanner] failed to load faculty name', e);
		}
	}

	// Query only ongoing activities; if OrganizationAdmin, scope by organization
	// Include activities where:
	// 1. Admin's organization is the organizer (organizerId)
	// 2. Admin's organization is in the legacy organizationId field
	// 3. Admin's organization is in the eligibleOrganizations array
	const whereClause =
		user.admin_role?.admin_level === 'OrganizationAdmin' && facultyId
			? and(
					eq(activities.status, 'ongoing'),
					or(
						eq(activities.organizationId, facultyId),
						eq(activities.organizerId, facultyId),
						sql`${activities.eligibleOrganizations} @> ${JSON.stringify([facultyId])}`
					)
				)
			: eq(activities.status, 'ongoing');

	const orgOrganizer = alias(organizations, 'org_organizer');
	const rows = await db
		.select({
			id: activities.id,
			title: activities.title,
			description: activities.description,
			start_date: activities.startDate,
			end_date: activities.endDate,
			start_time: activities.startTimeOnly,
			end_time: activities.endTimeOnly,
			activity_type: activities.activityType,
			location: activities.location,
			max_participants: activities.maxParticipants,
			hours: activities.hours,
			status: activities.status,
			faculty_id: activities.organizationId,
			organizer_id: activities.organizerId,
			organizer: orgOrganizer.name
		})
		.from(activities)
		.leftJoin(orgOrganizer, eq(activities.organizerId, orgOrganizer.id))
		.where(whereClause);

	// Get participant counts for all activities
	const participantCounts = await Promise.all(
		rows.map(async (activity) => {
			const countResult = await db
				.select({ count: sql<number>`cast(count(*) as int)` })
				.from(participations)
				.where(
					and(eq(participations.activityId, activity.id), eq(participations.status, 'checked_in'))
				);
			return {
				activity_id: activity.id,
				participant_count: countResult[0]?.count || 0
			};
		})
	);

	// Add participant counts to activity data
	const activitiesWithCounts = rows.map((activity) => {
		const countData = participantCounts.find((pc) => pc.activity_id === activity.id);
		return {
			...activity,
			current_participants: countData?.participant_count || 0
		};
	});

	const admin = {
		first_name: user.first_name,
		last_name: user.last_name,
		admin_level: user.admin_role?.admin_level || 'RegularAdmin',
		faculty_id: facultyId,
		faculty_name: facultyName
	};

	return {
		admin,
		activities: activitiesWithCounts,
		selectedActivityId
	};
};
