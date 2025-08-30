import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	try {
    // โหลดกิจกรรมจากฐานข้อมูลโดยตรง พร้อมเวลาเริ่ม-สิ้นสุด
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
            updated_at: activities.updatedAt
        })
        .from(activities)
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
        created_by: '',
        created_by_name: '',
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        is_registered: false
    };

    // ส่ง participations เป็น array เสมอเพื่อป้องกัน error บน client
    return {
        user,
        activity,
        participations: [] as any[]
    };
	} catch (e) {
		console.error('Error loading activity from database:', e);
		throw error(500, 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
	}
};
