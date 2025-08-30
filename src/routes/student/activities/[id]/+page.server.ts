import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities, participations, users as dbUsers, departments, organizations } from '$lib/server/db';
import { eq, and, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	try {
    // โหลดกิจกรรมจากฐานข้อมูลโดยตรง พร้อมเวลา/ผู้สร้าง/หน่วยงาน
    const result = await db
        .select({
            id: activities.id,
            title: activities.title,
            description: activities.description,
            start_date: activities.startDate,
            end_date: activities.endDate,
            start_time_only: activities.startTimeOnly,
            end_time_only: activities.endTimeOnly,
            activity_type: activities.activityType,
            status: activities.status,
            location: activities.location,
            max_participants: activities.maxParticipants,
            created_at: activities.createdAt,
            updated_at: activities.updatedAt,
            created_by: activities.createdBy,
            organizer_id: activities.organizerId,
            organization_id: activities.organizationId,
            organizer_name: organizations.name,
            creator_first_name: dbUsers.firstName,
            creator_last_name: dbUsers.lastName
            registration_open: activities.registrationOpen
        })
        .from(activities)
        .leftJoin(organizations, eq(activities.organizerId, organizations.id))
        .leftJoin(dbUsers, eq(activities.createdBy, dbUsers.id))
        .where(eq(activities.id, params.id))
        .limit(1);

		if (result.length === 0) {
			throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
		}

    const row = result[0];

    // รวมวันที่และเวลาเป็น ISO string ให้ฝั่ง client ใช้งานสะดวก
    const toISODateTime = (dateVal: unknown, timeVal?: unknown): string => {
        try {
            const d = dateVal instanceof Date ? new Date(dateVal) : new Date(String(dateVal));
            if (timeVal != null) {
                const t = String(timeVal);
                const [hh, mm, ss] = t.split(':');
                if (!Number.isNaN(Number(hh))) d.setHours(parseInt(hh || '0'));
                if (!Number.isNaN(Number(mm))) d.setMinutes(parseInt(mm || '0'));
                if (!Number.isNaN(Number(ss))) d.setSeconds(parseInt(ss || '0'));
                d.setMilliseconds(0);
            }
            return d.toISOString();
        } catch {
            return new Date().toISOString();
        }
    };

    const activity = {
        id: row.id,
        title: row.title,
        description: row.description || '',
        location: row.location || '',
        start_time: toISODateTime(row.start_date, row.start_time_only),
        end_time: toISODateTime(row.end_date, row.end_time_only),
        max_participants: row.max_participants ?? undefined,
        current_participants: 0,
        status: row.status as any,
        created_by: row.created_by || '',
        created_by_name: [row.creator_first_name, row.creator_last_name].filter(Boolean).join(' '),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        is_registered: false,
        organization_id: row.organization_id || row.organizer_id || undefined,
        organization_name: row.organizer_name || undefined,
        faculty_name: row.organizer_name || undefined,
        registration_open: row.registration_open ?? true
    };

    // โหลดรายชื่อผู้เข้าร่วมและสรุปสถานะของผู้ใช้ปัจจุบัน
    const partRows = await db
        .select({
            id: participations.id,
            status: participations.status,
            registered_at: participations.registeredAt,
            checked_in_at: participations.checkedInAt,
            checked_out_at: participations.checkedOutAt,
            user_id: dbUsers.id,
            user_first_name: dbUsers.firstName,
            user_last_name: dbUsers.lastName,
            student_id: dbUsers.studentId,
            department_name: departments.name
        })
        .from(participations)
        .leftJoin(dbUsers, eq(participations.userId, dbUsers.id))
        .leftJoin(departments, eq(dbUsers.departmentId, departments.id))
        .where(eq(participations.activityId, row.id));

    const participationsList = partRows.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        user_name: [p.user_first_name, p.user_last_name].filter(Boolean).join(' '),
        student_id: p.student_id,
        email: '',
        department_name: p.department_name || undefined,
        status: p.status as any,
        registered_at: p.registered_at?.toISOString?.() || String(p.registered_at),
        checked_in_at: p.checked_in_at ? (p.checked_in_at as Date).toISOString() : undefined,
        checked_out_at: p.checked_out_at ? (p.checked_out_at as Date).toISOString() : undefined
    }));

    activity.current_participants = participationsList.length;
    const mine = participationsList.find((p) => p.user_id === user.user_id);
    activity.is_registered = !!mine;
    if (mine) {
        (activity as any).user_participation_status = mine.status;
    }

    return {
        user,
        activity,
        participations: participationsList
    };
	} catch (e) {
		console.error('Error loading activity from database:', e);
		throw error(500, 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
	}
};
