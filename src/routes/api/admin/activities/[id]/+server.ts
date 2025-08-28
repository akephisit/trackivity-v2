import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireFacultyAdmin } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
  const user = await requireFacultyAdmin(event);
  const { id } = event.params;
  if (!id) return json({ success: false, error: 'Missing id' }, { status: 400 });

  try {
    const rows = await db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        location: activities.location,
        activity_type: activities.activityType,
        academic_year: activities.academicYear,
        organizer: activities.organizer,
        eligible_organizations: activities.eligibleOrganizations,
        start_date: activities.startDate,
        end_date: activities.endDate,
        start_time_only: activities.startTimeOnly,
        end_time_only: activities.endTimeOnly,
        hours: activities.hours,
        max_participants: activities.maxParticipants,
        status: activities.status,
        faculty_id: activities.facultyId,
        created_by: activities.createdBy,
        created_at: activities.createdAt,
        updated_at: activities.updatedAt
      })
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);

    if (rows.length === 0) return json({ success: false, error: 'ไม่พบกิจกรรม' }, { status: 404 });

    const row = rows[0];

    // Faculty admin can access only their faculty's activities (if faculty is assigned)
    if (user.admin_role?.admin_level === 'FacultyAdmin' && row.faculty_id && user.admin_role?.faculty_id && row.faculty_id !== user.admin_role.faculty_id) {
      return json({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    return json({ success: true, data: row });
  } catch (e) {
    console.error('Fetch activity error:', e);
    return json({ success: false, error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' }, { status: 500 });
  }
};
