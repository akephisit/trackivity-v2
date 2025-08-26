import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  const { params } = event;

  try {
    // โหลดกิจกรรมจากฐานข้อมูลโดยตรง
    const result = await db
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

    if (result.length === 0) {
      throw error(404, 'ไม่พบกิจกรรมที่ต้องการแก้ไข');
    }

    const activity = result[0];

    return { 
      user,
      activity 
    };
  } catch (e) {
    console.error('Error loading activity for edit from database:', e);
    throw error(500, 'ไม่สามารถโหลดข้อมูลกิจกรรมสำหรับแก้ไขได้');
  }
};