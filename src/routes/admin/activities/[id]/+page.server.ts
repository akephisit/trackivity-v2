import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, activities, participations, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
  const user = await requireAdmin(event);
  const { params } = event;

  try {
    // โหลดกิจกรรมจากฐานข้อมูลโดยตรง
    const activityResult = await db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        start_date: activities.startDate,
        end_date: activities.endDate,
        activity_type: activities.activityType,
        status: activities.status,
        location: activities.location,
        max_participants: activities.maxParticipants,
        created_at: activities.createdAt
      })
      .from(activities)
      .where(eq(activities.id, params.id))
      .limit(1);

    if (activityResult.length === 0) {
      throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
    }

    const activity = activityResult[0];

    // โหลดผู้เข้าร่วมกิจกรรม
    const participantsResult = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.firstName,
        last_name: users.lastName,
        student_id: users.studentId,
        participated_at: participations.createdAt
      })
      .from(participations)
      .innerJoin(users, eq(participations.userId, users.id))
      .where(eq(participations.activityId, params.id))
      .orderBy(participations.createdAt);

    return { 
      user,
      activity,
      participants: participantsResult
    };
  } catch (e) {
    console.error('Error loading activity details from database:', e);
    throw error(500, 'ไม่สามารถโหลดรายละเอียดกิจกรรมได้');
  }
};