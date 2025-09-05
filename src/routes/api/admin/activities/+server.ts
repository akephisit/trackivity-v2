import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { db, activities, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const user = requireOrganizationAdmin(event);

	let body: any;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const required = [
		'activity_name',
		'start_date',
		'end_date',
		'start_time',
		'end_time',
		'activity_type',
		'location',
		'hours',
    'organizer_id',
    'academic_year',
    'activity_level'
  ];
	const missing = required.filter((k) => !body[k] || String(body[k]).trim() === '');
	if (missing.length > 0) {
		return json(
			{ success: false, error: `ข้อมูลไม่ครบถ้วน: ${missing.join(', ')}` },
			{ status: 400 }
		);
	}

	try {
    const eligibleOrganizations: string[] = Array.isArray(body.eligible_organizations)
        ? body.eligible_organizations
        : typeof body.eligible_organizations === 'string'
            ? String(body.eligible_organizations)
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s !== '')
            : [];

		const maxParticipants =
			body.max_participants !== undefined &&
			body.max_participants !== null &&
			`${body.max_participants}`.trim() !== ''
				? Number(body.max_participants)
				: null;

    const hours = Number(body.hours) || 1;

    // Validate organizer_id exists in organizations
    const organizerId: string = String(body.organizer_id);
    if (!organizerId) {
      return json({ success: false, error: 'กรุณาเลือกหน่วยงานผู้จัด (organizer_id)' }, { status: 400 });
    }
    const organizerRows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizerId))
      .limit(1);
    if (organizerRows.length === 0) {
      return json({ success: false, error: 'ไม่พบหน่วยงานผู้จัดที่เลือก' }, { status: 400 });
    }

    let organizationId =
      user.admin_role?.admin_level === 'OrganizationAdmin'
        ? (user.admin_role?.organization_id ?? null)
        : null;
    // If SuperAdmin creates and didn't set owner, default owner to organizer
    if (!organizationId) {
      organizationId = organizerId;
    }

    // Validate activity_level
    const activityLevel = body.activity_level;
    if (!['faculty', 'university'].includes(activityLevel)) {
      return json({ success: false, error: 'ระดับกิจกรรมไม่ถูกต้อง ต้องเป็น "faculty" หรือ "university"' }, { status: 400 });
    }

    const [inserted] = await db
      .insert(activities)
      .values({
        title: body.activity_name,
        description: (body.description ?? '').toString(),
        location: body.location,
        activityType: body.activity_type,
        academicYear: body.academic_year,
        organizerId: organizerId,
        activityLevel: activityLevel,
        eligibleOrganizations: eligibleOrganizations as any,
        startDate: body.start_date,
        endDate: body.end_date,
        startTimeOnly: body.start_time,
        endTimeOnly: body.end_time,
        hours,
        maxParticipants,
        // status defaults to 'draft' per schema
        organizationId: organizationId,
        createdBy: user.user_id
      })
      .returning({ id: activities.id });

		return json({ success: true, data: { id: inserted.id } }, { status: 201 });
	} catch (e) {
		console.error('Create activity error:', e);
		return json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างกิจกรรม' }, { status: 500 });
	}
};
