import { requireFacultyAdmin } from '$lib/server/auth-utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Activity } from '$lib/types/activity';
import { AdminLevel } from '$lib/types/admin';
import { db, activities, faculties, users, participations } from '$lib/server/db';
import { eq, and, desc, count, sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	// ตรวจสอบสิทธิ์ - เฉพาะ FacultyAdmin หรือ SuperAdmin
	const user = await requireFacultyAdmin(event);
	const adminLevel = user.admin_role?.admin_level;
	const facultyId = user.admin_role?.faculty_id;

	try {
		// กำหนด API endpoint ตามระดับแอดมิน
		let apiEndpoint: string;
		let params: Record<string, string> = {};
		
		if (adminLevel === AdminLevel.SuperAdmin) {
			// SuperAdmin ดูกิจกรรมทั้งหมด
			apiEndpoint = `/api/admin/activities`;
		} else if (adminLevel === AdminLevel.FacultyAdmin) {
			// FacultyAdmin ดูเฉพาะกิจกรรมในคณะของตัวเอง
			if (!facultyId) {
				throw error(403, 'Faculty admin ต้องมี faculty_id');
			}
			apiEndpoint = `/api/admin/activities`;
			params.faculty_id = facultyId;
		} else {
			throw error(403, 'ไม่มีสิทธิ์เข้าถึงข้อมูลกิจกรรม');
		}

		// Query activities directly from database
		let query = db
			.select({
				id: activities.id,
				title: activities.title,
				description: activities.description,
				start_date: activities.startDate,
				end_date: activities.endDate,
				start_time: activities.startTimeOnly,
				end_time: activities.endTimeOnly,
				activity_type: activities.activityType,
				location: activities.location,
				max_participants: activities.maxParticipants,
				hours: activities.hours,
				status: activities.status,
				faculty_id: activities.facultyId,
				created_by: activities.createdBy,
				created_at: activities.createdAt,
				updated_at: activities.updatedAt,
				organizer: activities.organizer
			})
			.from(activities);

		// Apply faculty filtering for FacultyAdmin
		if (adminLevel === AdminLevel.FacultyAdmin && facultyId) {
			query = query.where(eq(activities.facultyId, facultyId));
		}

		const rawActivities = await query.orderBy(desc(activities.createdAt));
		
		activitiesData = rawActivities.map((activity: any) => ({
				id: activity.id,
				activity_name: activity.title,
				description: activity.description,
				start_date: activity.start_date,
				end_date: activity.end_date,
				start_time: activity.start_time,
				end_time: activity.end_time,
				activity_type: activity.activity_type,
				location: activity.location,
				max_participants: activity.max_participants,
				hours: activity.hours,
				require_score: false, // Not in current schema
				faculty_id: activity.faculty_id,
				created_by: activity.created_by,
				created_at: activity.created_at,
				updated_at: activity.updated_at,
				// Legacy fields for compatibility
				name: activity.title,
				organizer: activity.organizer || 'ระบบ',
				organizerType: 'คณะ',
				participantCount: 0, // TODO: Count from participations table
				status: activity.status || 'รอดำเนินการ'
			}));

		return {
			activities: activitiesData,
			user,
			adminLevel,
			facultyId,
			canCreateActivity: adminLevel === AdminLevel.SuperAdmin || adminLevel === AdminLevel.FacultyAdmin
		};

	} catch (err) {
		console.error('Error loading activities:', err);
		
		// ถ้าเป็น error ที่ throw มาแล้ว ให้ส่งต่อไป
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		
		// สำหรับ error อื่นๆ ให้ส่งค่าเริ่มต้นแทนการ throw
		return {
			activities: [],
			user,
			adminLevel,
			facultyId,
			canCreateActivity: adminLevel === AdminLevel.SuperAdmin || adminLevel === AdminLevel.FacultyAdmin
		};
	}
};

export const actions: Actions = {
    delete: async (event) => {
        // Ensure only FacultyAdmin/SuperAdmin can delete
        await requireFacultyAdmin(event);

        try {
            const formData = await event.request.formData();
            const activityId = formData.get('activityId');
            if (!activityId || typeof activityId !== 'string') {
                return fail(400, { error: 'ไม่พบรหัสกิจกรรม' });
            }

            // Delete activity directly from database
            await db.delete(activities).where(eq(activities.id, activityId));

            // Success
            return { success: true };
        } catch (err) {
            console.error('Delete activity error:', err);
            return fail(500, { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
        }
    }
};
