import { json, type RequestHandler } from '@sveltejs/kit';
import { db, activities, participations } from '$lib/server/db';
import { and, count, eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return json(
        { success: false, error: { code: 'AUTH_ERROR', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const activityId = params.id;
    if (!activityId) {
      return json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing activity id' } },
        { status: 400 }
      );
    }

    // Load target activity
    const actRows = await db
      .select({
        id: activities.id,
        status: activities.status,
        max_participants: activities.maxParticipants
      })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);

    if (actRows.length === 0) {
      return json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Activity not found' } },
        { status: 404 }
      );
    }

    const act = actRows[0];
    if (act.status !== 'published' && act.status !== 'ongoing') {
      return json(
        { success: false, error: { code: 'NOT_OPEN', message: 'Activity is not open for registration' } },
        { status: 400 }
      );
    }

    // Check if already registered
    const existing = await db
      .select({ c: count() })
      .from(participations)
      .where(and(eq(participations.activityId, activityId), eq(participations.userId, user.id)));

    if ((existing[0]?.c || 0) > 0) {
      return json({ success: true, data: { message: 'Already registered' } });
    }

    // Capacity check
    if (act.max_participants && act.max_participants > 0) {
      const current = await db
        .select({ c: count() })
        .from(participations)
        .where(eq(participations.activityId, activityId));
      const currentCount = current[0]?.c || 0;
      if (currentCount >= act.max_participants) {
        return json(
          { success: false, error: { code: 'FULL', message: 'Activity is full' } },
          { status: 400 }
        );
      }
    }

    // Create participation
    await db.insert(participations).values({ activityId, userId: user.id, status: 'registered' as any });

    return json({ success: true, data: { activity_id: activityId, status: 'registered' } });
  } catch (e) {
    console.error('[Participate] error:', e);
    return json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register' } },
      { status: 500 }
    );
  }
};

