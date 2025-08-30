import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, activities, organizations, users as dbUsers } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	event.depends('student:activities');

	try {
    // โหลดกิจกรรมจากฐานข้อมูลโดยตรง พร้อมชื่อหน่วยงานและผู้สร้าง
    const rows = await db
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
            organizer_id: activities.organizerId,
            organization_id: activities.organizationId,
            organization_name: organizations.name,
            creator_first_name: dbUsers.firstName,
            creator_last_name: dbUsers.lastName
        })
        .from(activities)
        .leftJoin(organizations, eq(activities.organizerId, organizations.id))
        .leftJoin(dbUsers, eq(activities.createdBy, dbUsers.id))
        .orderBy(desc(activities.createdAt))
        .limit(50);

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

        const list = rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description || '',
            location: r.location || '',
            start_time: toISODateTime(r.start_date, r.start_time_only),
            end_time: toISODateTime(r.end_date, r.end_time_only),
            start_date: r.start_date,
            end_date: r.end_date,
            activity_type: r.activity_type,
            status: r.status,
            max_participants: r.max_participants ?? undefined,
            current_participants: undefined,
            created_at: r.created_at,
            updated_at: r.updated_at,
            organization_id: r.organization_id || r.organizer_id || undefined,
            organization_name: r.organization_name || undefined,
            created_by_name: [r.creator_first_name, r.creator_last_name].filter(Boolean).join(' ')
        }));

        return {
            user,
            activities: list
        };
	} catch (e) {
		console.error('Error loading activities from database:', e);
		return {
			user,
			activities: []
		};
	}
};
