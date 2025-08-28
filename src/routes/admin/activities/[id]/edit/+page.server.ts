import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Activity, ActivityStatus } from '$lib/types/activity';
import { requireFacultyAdmin } from '$lib/server/auth-utils';
import { db, activities, faculties } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
  const { params } = event;
  const { id } = params;
  if (!id) throw error(404, 'Activity ID is required');

  await requireFacultyAdmin(event);

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

    if (rows.length === 0) throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
    const a = rows[0];

    const startIso = a.start_date && a.start_time_only ? new Date(`${a.start_date}T${a.start_time_only}`).toISOString() : (a.start_date as any);
    const endIso = a.end_date && a.end_time_only ? new Date(`${a.end_date}T${a.end_time_only}`).toISOString() : (a.end_date as any);

    const activity: Activity = {
      id: a.id,
      title: a.title,
      description: a.description || '',
      location: a.location || '',
      start_time: startIso,
      end_time: endIso,
      max_participants: a.max_participants ?? undefined,
      current_participants: 0,
      status: a.status as any,
      faculty_id: a.faculty_id || undefined,
      faculty_name: undefined,
      created_by: a.created_by,
      created_by_name: 'ระบบ',
      created_at: a.created_at?.toISOString?.() || new Date().toISOString(),
      updated_at: a.updated_at?.toISOString?.() || new Date().toISOString(),
      is_registered: false,
      activity_type: a.activity_type || undefined,
      hours: a.hours ?? undefined,
      organizer: a.organizer ?? undefined,
      academic_year: a.academic_year ?? undefined,
      start_date: a.start_date as any,
      end_date: a.end_date as any,
      start_time_only: a.start_time_only as any,
      end_time_only: a.end_time_only as any
    };

    const facs = await db
      .select({ id: faculties.id, name: faculties.name })
      .from(faculties);
    return { activity, faculties: facs };
  } catch (e) {
    console.error('Error loading activity for edit:', e);
    throw error(500, 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

export const actions: Actions = {
  update: async (event) => {
    await requireFacultyAdmin(event);
    const { params, request } = event;
    const { id } = params;
    if (!id) return fail(400, { error: 'ไม่พบรหัสกิจกรรม' } as const);

    const formData = await request.formData();
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const location = (formData.get('location') as string) || '';
    const start_time = formData.get('start_time') as string | null;
    const end_time = formData.get('end_time') as string | null;
    const max_participants = formData.get('max_participants') as string | null;
    const status = formData.get('status') as string | null;
    const faculty_id = formData.get('faculty_id') as string | null;

    if (!title || !location || !start_time || !end_time) {
      return fail(400, { error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' } as const);
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return fail(400, { error: 'วันที่/เวลาไม่ถูกต้อง' } as const);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

    try {
      const startDateStr = toDateStr(start);
      const endDateStr = toDateStr(end);

      const maxParticipantsVal = max_participants && max_participants.trim() !== '' ? parseInt(max_participants, 10) : null;
      if (maxParticipantsVal !== null && (isNaN(maxParticipantsVal) || maxParticipantsVal < 1)) {
        return fail(400, { error: 'จำนวนผู้เข้าร่วมสูงสุดต้องเป็นตัวเลขมากกว่า 0' } as const);
      }

      await db.update(activities).set({
        title,
        description: description || '',
        location,
        startDate: startDateStr as any,
        endDate: endDateStr as any,
        startTimeOnly: toTime(start),
        endTimeOnly: toTime(end),
        maxParticipants: maxParticipantsVal,
        status: (status as ActivityStatus) || 'draft',
        facultyId: faculty_id && faculty_id.trim() !== '' ? faculty_id : null,
        updatedAt: new Date()
      }).where(eq(activities.id, id));

      // Navigate back to activity detail on success
      throw redirect(302, `/admin/activities/${id}`);
    } catch (e: any) {
      // Let SvelteKit redirects pass through
      if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
        throw e;
      }
      console.error('Error updating activity (DB):', e?.message || e);
      return fail(500, { error: `เกิดข้อผิดพลาดในการอัปเดตกิจกรรม: ${e?.message || 'ไม่ทราบสาเหตุ'}` } as const);
    }
  }
};
