import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireFacultyAdmin } from '$lib/server/auth-utils';
import { db, activities, users, faculties, participations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
  const user = await requireFacultyAdmin(event);
  const { params } = event;

  if (!params.id) throw error(400, 'ไม่พบรหัสกิจกรรม');

  try {
    // Load activity core fields including eligible faculties
    const rows = await db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        location: activities.location,
        activity_type: activities.activityType,
        academic_year: activities.academicYear,
        organizer: activities.organizer,
        eligible_faculties: activities.eligibleFaculties,
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
      .where(eq(activities.id, params.id))
      .limit(1);

    if (rows.length === 0) throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
    const a = rows[0];

    // Stats for current participants
    const participationRows = await db
      .select({ id: participations.id })
      .from(participations)
      .where(eq(participations.activityId, params.id));

    const startIso = a.start_date && a.start_time_only ? new Date(`${a.start_date}T${a.start_time_only}`).toISOString() : a.start_date as any;
    const endIso = a.end_date && a.end_time_only ? new Date(`${a.end_date}T${a.end_time_only}`).toISOString() : a.end_date as any;

    const activity = {
      id: a.id,
      title: a.title,
      description: a.description || '',
      location: a.location || '',
      start_time: startIso,
      end_time: endIso,
      max_participants: a.max_participants ?? undefined,
      current_participants: participationRows.length,
      status: a.status as any,
      faculty_id: a.faculty_id || undefined,
      faculty_name: undefined,
      created_by: a.created_by,
      created_by_name: '',
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

    // Fetch faculties for options
    const facultiesList = await db.select({ id: faculties.id, name: faculties.name, code: faculties.code }).from(faculties);

    const eligible_faculties_selected: string[] = Array.isArray(a.eligible_faculties) ? (a.eligible_faculties as any) : [];

    return {
      user,
      activity,
      faculties: facultiesList,
      eligible_faculties_selected
    };
  } catch (e) {
    console.error('Edit activity load error:', e);
    throw error(500, 'ไม่สามารถโหลดข้อมูลสำหรับแก้ไขได้');
  }
};

export const actions: Actions = {
  update: async (event) => {
    await requireFacultyAdmin(event);
    const { params } = event;
    if (!params.id) return { error: 'ไม่พบรหัสกิจกรรม' } as const;

    const fd = await event.request.formData();

    const title = (fd.get('title') || '').toString().trim();
    const description = (fd.get('description') || '').toString();
    const location = (fd.get('location') || '').toString().trim();
    const startTime = (fd.get('start_time') || '').toString(); // yyyy-MM-ddTHH:mm
    const endTime = (fd.get('end_time') || '').toString();
    const maxParticipantsRaw = (fd.get('max_participants') || '').toString();
    const status = (fd.get('status') || '').toString();
    const facultyIdRaw = (fd.get('faculty_id') || '').toString();
    const eligibleRaw = (fd.get('eligible_faculties') || '').toString();

    if (!title || !location || !startTime || !endTime) {
      return { error: 'ข้อมูลไม่ครบถ้วน' } as const;
    }

    // Validate status
    const allowed = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return { error: 'สถานะไม่ถูกต้อง' } as const;
    }

    // Parse datetimes into date + time
    const [startDateStr, startTimeStr] = startTime.split('T');
    const [endDateStr, endTimeStr] = endTime.split('T');
    if (!startDateStr || !startTimeStr || !endDateStr || !endTimeStr) {
      return { error: 'รูปแบบวันเวลาไม่ถูกต้อง' } as const;
    }

    const maxParticipants = maxParticipantsRaw ? Number(maxParticipantsRaw) : null;
    const facultyId = facultyIdRaw || null;
    const eligibleFaculties = eligibleRaw
      ? eligibleRaw.split(',').map((s) => s.trim()).filter((s) => s !== '')
      : [];

    try {
      await db
        .update(activities)
        .set({
          title,
          description: description || '',
          location,
          startDate: startDateStr,
          endDate: endDateStr,
          startTimeOnly: startTimeStr,
          endTimeOnly: endTimeStr,
          maxParticipants,
          status: status as any,
          facultyId,
          eligibleFaculties: eligibleFaculties as any,
          updatedAt: new Date()
        })
        .where(eq(activities.id, params.id));

      throw redirect(302, `/admin/activities/${params.id}`);
    } catch (e) {
      console.error('Update activity error:', e);
      return { error: 'อัปเดตกิจกรรมไม่สำเร็จ' } as const;
    }
  }
};

