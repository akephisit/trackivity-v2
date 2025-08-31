import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, participations, activities } from '$lib/server/db';
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
        // activity fields
        a_id: activities.id,
        a_title: activities.title,
        a_description: activities.description,
        a_location: activities.location,
        a_type: activities.activityType,
        a_start_date: activities.startDate,
        a_end_date: activities.endDate
      })
      .from(participations)
      .leftJoin(activities, eq(participations.activityId, activities.id))
      .where(eq(participations.userId, user.user_id));

    // Show only records that have both check-in and check-out
    const rows = rowsAll.filter((r) => !!r.checked_in_at && !!r.checked_out_at);

    const history = rows.map((r) => {
      // Use check-out time as participation completion timestamp
      const participated_at = (r.checked_out_at || r.checked_in_at || r.registered_at || new Date()).toISOString?.() || String(r.checked_out_at || r.checked_in_at || r.registered_at || new Date());
      return {
        id: r.id,
        activity_id: r.activity_id,
        user_id: r.user_id,
        participated_at,
        qr_scan_location: undefined,
        activity: {
          id: r.a_id,
          name: r.a_title,
          title: r.a_title,
          description: r.a_description || '',
          activity_type: r.a_type || 'event',
          location: r.a_location || '',
          start_date: r.a_start_date as any,
          end_date: r.a_end_date as any
        }
      };
    });

    return { history };
  } catch (e) {
    console.error('[Student History] load error:', e);
    return { history: [] };
  }
};
