import type { PageServerLoad, Actions } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, activities, participations, users, organizations } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);
	const { params } = event;

	try {
		// Load activity details (with faculty and creator)
    const orgOwner = alias(organizations, 'org_owner');
    const orgOrganizer = alias(organizations, 'org_organizer');

    const activityRows = await db
      .select({
        id: activities.id,
        title: activities.title,
        description: activities.description,
        location: activities.location,
        activity_type: activities.activityType,
        academic_year: activities.academicYear,
        organizer_id: activities.organizerId,
        organizer_name: orgOrganizer.name,
        eligible_organizations: activities.eligibleOrganizations,
        start_date: activities.startDate,
        end_date: activities.endDate,
        start_time_only: activities.startTimeOnly,
        end_time_only: activities.endTimeOnly,
        hours: activities.hours,
        max_participants: activities.maxParticipants,
        status: activities.status,
        organization_id: activities.organizationId,
        created_by: activities.createdBy,
        created_at: activities.createdAt,
        updated_at: activities.updatedAt,
        organization_name: orgOwner.name,
        creator_first: users.firstName,
        creator_last: users.lastName
      })
      .from(activities)
      .leftJoin(orgOwner, eq(activities.organizationId, orgOwner.id))
      .leftJoin(orgOrganizer, eq(activities.organizerId, orgOrganizer.id))
      .leftJoin(users, eq(activities.createdBy, users.id))
      .where(eq(activities.id, params.id))
      .limit(1);

		if (activityRows.length === 0) {
			throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
		}

		const a = activityRows[0];

		// Load participation list
		const participationRows = await db
			.select({
				id: participations.id,
				user_id: users.id,
				email: users.email,
				first_name: users.firstName,
				last_name: users.lastName,
				student_id: users.studentId,
				department_id: users.departmentId,
				status: participations.status,
				registered_at: participations.registeredAt,
				checked_in_at: participations.checkedInAt,
				checked_out_at: participations.checkedOutAt,
				notes: participations.notes
			})
			.from(participations)
			.innerJoin(users, eq(participations.userId, users.id))
			.where(eq(participations.activityId, params.id));

		// Compute stats
		const participationStats = {
			total: participationRows.length,
			registered: participationRows.filter((p) => p.status === 'registered').length,
			checked_in: participationRows.filter((p) => p.status === 'checked_in').length,
			completed: participationRows.filter((p) => p.status === 'completed').length
		};

		// Map to Activity type expected by page
		const startIso =
			a.start_date && a.start_time_only
				? new Date(`${a.start_date}T${a.start_time_only}`).toISOString()
				: (a.start_date as any);
		const endIso =
			a.end_date && a.end_time_only
				? new Date(`${a.end_date}T${a.end_time_only}`).toISOString()
				: (a.end_date as any);

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
      organization_id: a.organization_id || undefined,
      organization_name: a.organization_name || undefined,
      created_by: a.created_by,
      created_by_name: `${a.creator_first ?? ''} ${a.creator_last ?? ''}`.trim() || 'ระบบ',
      created_at: a.created_at?.toISOString?.() || new Date().toISOString(),
      updated_at: a.updated_at?.toISOString?.() || new Date().toISOString(),
      is_registered: false,
      activity_type: a.activity_type || undefined,
      hours: a.hours ?? undefined,
      organizer: a.organizer_name ?? undefined,
      organizer_id: a.organizer_id ?? undefined,
      academic_year: a.academic_year ?? undefined,
      start_date: a.start_date as any,
      end_date: a.end_date as any,
      start_time_only: a.start_time_only as any,
      end_time_only: a.end_time_only as any
    };

		const participationsList = participationRows.map((p) => ({
			id: p.id,
			user_id: p.user_id,
			user_name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email,
			student_id: p.student_id,
			email: p.email,
			department_name: undefined,
			status: p.status as any,
			registered_at: p.registered_at?.toISOString?.() || new Date().toISOString(),
			checked_in_at: p.checked_in_at?.toISOString?.(),
			checked_out_at: p.checked_out_at?.toISOString?.(),
			notes: p.notes || undefined
		}));

		// Load all organizations for selection on edit page
		let facultiesList: Array<{ id: string; name: string; code?: string }>;
		try {
			const rows = await db
				.select({ id: organizations.id, name: organizations.name, code: organizations.code })
				.from(organizations);
			facultiesList = rows as any;
		} catch (e) {
			console.error('Error loading organizations list:', e);
			facultiesList = [];
		}

		// Eligible faculties (array of UUIDs) from activity
		const eligible_organizations_selected: string[] = Array.isArray(a.eligible_organizations)
			? (a.eligible_organizations as any)
			: [];

		return {
			user,
			activity,
			participations: participationsList,
			participationStats,
			faculties: facultiesList,
			eligible_organizations_selected
		};
	} catch (e) {
		console.error('Error loading activity details from database:', e);
		throw error(500, 'ไม่สามารถโหลดรายละเอียดกิจกรรมได้');
	}
};

export const actions: Actions = {
	updateStatus: async (event) => {
		const user = requireAdmin(event);
		const { params } = event;
		const formData = await event.request.formData();
		const status = formData.get('status') as string | null;

		if (!params.id) return { error: 'ไม่พบรหัสกิจกรรม' } as const;
		if (!status) return { error: 'กรุณาเลือกสถานะ' } as const;

		const allowed = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];
		if (!allowed.includes(status)) {
			return { error: 'สถานะไม่ถูกต้อง' } as const;
		}

		try {
			await db
				.update(activities)
				.set({ status: status as any, updatedAt: new Date() })
				.where(eq(activities.id, params.id));
			return { success: true } as const;
		} catch (e) {
			console.error('Update status error:', e);
			return { error: 'อัปเดตสถานะไม่สำเร็จ' } as const;
		}
	},
	deleteActivity: async (event) => {
		const user = requireAdmin(event);
		const { params } = event;
		if (!params.id) {
			return { error: 'ไม่พบรหัสกิจกรรม' } as const;
		}
		try {
			await db.delete(activities).where(eq(activities.id, params.id));
			// Redirect back to activities list with flash flag
			throw redirect(302, '/admin/activities?deleted=1');
		} catch (e) {
			// Allow SvelteKit Redirect objects to pass through
			if (e && typeof e === 'object' && 'status' in (e as any) && 'location' in (e as any)) {
				throw e as any;
			}
			console.error('Delete activity error:', e);
			return { error: 'ลบกิจกรรมไม่สำเร็จ' } as const;
		}
	},
	removeParticipant: async (event) => {
		const user = requireAdmin(event);
		const formData = await event.request.formData();
		const participationId = formData.get('participationId') as string | null;
		if (!participationId) {
			return { error: 'ไม่พบรหัสผู้เข้าร่วม' } as const;
		}
		try {
			await db.delete(participations).where(eq(participations.id, participationId));
			return { success: true } as const;
		} catch (e) {
			console.error('Remove participant error:', e);
			return { error: 'ลบผู้เข้าร่วมไม่สำเร็จ' } as const;
		}
	}
};
