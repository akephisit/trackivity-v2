import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AdminLevel } from '$lib/types/admin';
import { db, activities, organizations } from '$lib/server/db';
import { eq, or, desc, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	// ตรวจสอบสิทธิ์ - เฉพาะ FacultyAdmin หรือ SuperAdmin
	const user = requireOrganizationAdmin(event);
	const adminLevel = user.admin_role?.admin_level;
	const organizationId = user.admin_role?.organization_id;

	try {
		// ตรวจสอบสิทธิ์: SuperAdmin ดูทั้งหมด / FacultyAdmin ต้องมี faculty_id
		if (adminLevel !== AdminLevel.SuperAdmin && adminLevel !== AdminLevel.OrganizationAdmin) {
			throw error(403, 'ไม่มีสิทธิ์เข้าถึงข้อมูลกิจกรรม');
		}
		if (adminLevel === AdminLevel.OrganizationAdmin && !organizationId) {
			throw error(403, 'Organization admin ต้องมี organization_id');
		}

		// Query activities directly from database
		const baseQuery = db
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
				participant_count: activities.participantCount,
				view_count: activities.viewCount,
				hours: activities.hours,
				status: activities.status,
				organization_id: activities.organizationId,
				created_by: activities.createdBy,
				created_at: activities.created_at,
				updated_at: activities.updated_at,
				organizer_id: activities.organizerId,
				organizer_name: organizations.name,
				activity_level: activities.activityLevel
			})
			.from(activities)
			.leftJoin(organizations, eq(activities.organizerId, organizations.id));

		// Apply faculty filtering for FacultyAdmin and exclude soft deleted activities
		const baseConditions = [sql`${activities.deletedAt} IS NULL`];
		
		if (adminLevel === AdminLevel.OrganizationAdmin && organizationId) {
			const orgCondition = or(
				eq(activities.organizationId, organizationId),
				eq(activities.organizerId, organizationId)
			);
			if (orgCondition) {
				baseConditions.push(orgCondition);
			}
		}
		
		const filteredQuery = baseConditions.length > 0 
			? baseQuery.where(and(...baseConditions))
			: baseQuery;

		const rawActivities = await filteredQuery.orderBy(desc(activities.created_at));

		const activitiesData = rawActivities.map((activity: any) => ({
			id: activity.id,
			title: activity.title,
			description: activity.description,
			start_date: activity.start_date,
			end_date: activity.end_date,
			start_time: activity.start_time,
			end_time: activity.end_time,
			activity_type: activity.activity_type,
			location: activity.location,
			max_participants: activity.max_participants,
			participant_count: activity.participant_count || 0,
			view_count: activity.view_count || 0,
			hours: activity.hours,
			organization_id: activity.organization_id,
			organizer_id: activity.organizer_id,
			organizer_name: activity.organizer_name,
			created_by: activity.created_by,
			created_at: activity.created_at,
			updated_at: activity.updated_at,
			status: activity.status,
			activity_level: activity.activity_level
		}));

		return {
			activities: activitiesData,
			user,
			adminLevel,
			organizationId,
			canCreateActivity:
				adminLevel === AdminLevel.SuperAdmin || adminLevel === AdminLevel.OrganizationAdmin
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
			organizationId,
			canCreateActivity:
				adminLevel === AdminLevel.SuperAdmin || adminLevel === AdminLevel.OrganizationAdmin
		};
	}
};

export const actions: Actions = {
	delete: async (event) => {
		// Ensure only OrganizationAdmin/SuperAdmin can delete
		requireOrganizationAdmin(event);

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
