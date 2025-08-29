import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { db, activities, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const user = await requireOrganizationAdmin(event);
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
        organizer_id: activities.organizerId,
        organizer_name: organizations.name,
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
        updated_at: activities.updatedAt
      })
      .from(activities)
      .leftJoin(organizations, eq(activities.organizerId, organizations.id))
      .where(eq(activities.id, id))
      .limit(1);

		if (rows.length === 0) return json({ success: false, error: 'ไม่พบกิจกรรม' }, { status: 404 });

    const row = rows[0];

		// Organization admin can access only their organization's activities (if org is assigned)
		if (
			user.admin_role?.admin_level === 'OrganizationAdmin' &&
			row.organization_id &&
			user.admin_role?.organization_id &&
			row.organization_id !== user.admin_role.organization_id
		) {
			return json({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
		}

    // Backward compatibility: include organizer as name
    const data = {
      ...row,
      organizer: row.organizer_name
    };
    return json({ success: true, data });
	} catch (e) {
		console.error('Fetch activity error:', e);
		return json({ success: false, error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' }, { status: 500 });
	}
};
