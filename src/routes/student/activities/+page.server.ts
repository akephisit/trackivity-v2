import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
  const user = await requireAuth(event);
  event.depends('student:activities');

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
      .orderBy(desc(activities.createdAt))
      .limit(50);

    return { 
      user,
      activities: result 
    };
  } catch (e) {
    console.error('Error loading activities from database:', e);
    return { 
      user,
      activities: [] 
    };
  }
};

