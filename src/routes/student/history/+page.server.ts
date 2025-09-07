import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, participations, activities, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	event.depends('student:history');

	try {
		const rowsAll = await db
			.select({
				id: participations.id,
				activity_id: participations.activityId,
				user_id: participations.userId,
				registered_at: participations.registeredAt,
				checked_in_at: participations.checkedInAt,
				checked_out_at: participations.checkedOutAt,
				status: participations.status,
				notes: participations.notes,
				// activity fields
				a_id: activities.id,
				a_title: activities.title,
				a_description: activities.description,
				a_location: activities.location,
				a_type: activities.activityType,
				a_start_date: activities.startDate,
				a_end_date: activities.endDate,
				a_start_time: activities.startTimeOnly,
				a_end_time: activities.endTimeOnly,
				a_hours: activities.hours,
				a_status: activities.status,
				a_organizer_id: activities.organizerId,
				a_activity_level: activities.activityLevel,
				// organizer organization
				org_name: organizations.name
			})
			.from(participations)
			.leftJoin(activities, eq(participations.activityId, activities.id))
			.leftJoin(organizations, eq(activities.organizerId, organizations.id))
			.where(eq(participations.userId, user.user_id));

		// Show records with different participation statuses, not just completed ones
		const history = rowsAll.map((r) => {
			// Calculate participation duration if both times are available
			let participationDurationMinutes: number | null = null;
			if (r.checked_in_at && r.checked_out_at) {
				const checkinTime = new Date(r.checked_in_at).getTime();
				const checkoutTime = new Date(r.checked_out_at).getTime();
				participationDurationMinutes = Math.round((checkoutTime - checkinTime) / (1000 * 60));
			}

			// Use the most relevant timestamp for participated_at
			const participated_at =
				(r.checked_out_at || r.checked_in_at || r.registered_at || new Date()).toISOString?.() ||
				String(r.checked_out_at || r.checked_in_at || r.registered_at || new Date());

			return {
				id: r.id,
				activity_id: r.activity_id,
				user_id: r.user_id,
				participated_at,
				registered_at: r.registered_at?.toISOString?.() || String(r.registered_at || ''),
				checked_in_at:
					r.checked_in_at?.toISOString?.() || (r.checked_in_at ? String(r.checked_in_at) : null),
				checked_out_at:
					r.checked_out_at?.toISOString?.() || (r.checked_out_at ? String(r.checked_out_at) : null),
				status: r.status,
				notes: r.notes,
				participation_duration_minutes: participationDurationMinutes,
				qr_scan_location: undefined,
				activity: {
					id: r.a_id,
					name: r.a_title,
					title: r.a_title,
					description: r.a_description || '',
					activity_type: r.a_type || 'Other',
					location: r.a_location || '',
					start_date: r.a_start_date as any,
					end_date: r.a_end_date as any,
					start_time: r.a_start_time,
					end_time: r.a_end_time,
					hours: r.a_hours,
					status: r.a_status,
					organizer_name: r.org_name,
					activity_level: r.a_activity_level
				}
			};
		});

		return { history };
	} catch (e) {
		console.error('[Student History] load error:', e);
		return { history: [] };
	}
};
