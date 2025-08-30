import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { db, activities, users, organizations, participations } from '$lib/server/db';
import { alias } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = await requireOrganizationAdmin(event);
	const { params } = event;

	if (!params.id) throw error(400, 'ไม่พบรหัสกิจกรรม');

	try {
		// Load activity core fields including eligible faculties
    const orgOrganizer = alias(organizations, 'org_organizer');
    const rows = await db
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
        registration_open: activities.registrationOpen
      })
      .from(activities)
      .leftJoin(orgOrganizer, eq(activities.organizerId, orgOrganizer.id))
      .where(eq(activities.id, params.id))
      .limit(1);

		if (rows.length === 0) throw error(404, 'ไม่พบกิจกรรมที่ระบุ');
		const a = rows[0];

		// Stats for current participants
		const participationRows = await db
			.select({ id: participations.id })
			.from(participations)
			.where(eq(participations.activityId, params.id));

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
      faculty_name: undefined,
      created_by: a.created_by,
      created_by_name: '',
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
      end_time_only: a.end_time_only as any,
      registration_open: (a as any).registration_open ?? true
    };

		// Fetch organizations for options
		const facultiesList = await db
			.select({ id: organizations.id, name: organizations.name, code: organizations.code })
			.from(organizations);

		const eligible_organizations_selected: string[] = Array.isArray(a.eligible_organizations)
			? (a.eligible_organizations as any)
			: [];

		return {
			user,
			activity,
			faculties: facultiesList,
			eligible_organizations_selected
		};
	} catch (e) {
		console.error('Edit activity load error:', e);
		throw error(500, 'ไม่สามารถโหลดข้อมูลสำหรับแก้ไขได้');
	}
};

export const actions: Actions = {
    update: async (event) => {
        const user = await requireOrganizationAdmin(event);
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
        const registrationOpen = !!fd.get('registration_open');
		// FacultyId is deprecated in UI; preserve existing value server-side
		// const facultyIdRaw = (fd.get('faculty_id') || '').toString();
		const eligibleRaw = (fd.get('eligible_organizations') || '').toString();
    	const organizerId = (fd.get('organizer_id') || '').toString().trim();

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
        const eligibleOrganizations = eligibleRaw
            ? eligibleRaw
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s !== '')
            : [];

        // Permission: only SuperAdmin can change organizer_id
        const isSuperAdmin = (user as any)?.admin_role?.admin_level === 'SuperAdmin';

        // Load current organizer_id to prevent unauthorized change
        let currentOrganizerId: string | null = null;
        try {
            const cur = await db
                .select({ organizer_id: activities.organizerId })
                .from(activities)
                .where(eq(activities.id, params.id))
                .limit(1);
            currentOrganizerId = (cur[0]?.organizer_id as any) ?? null;
        } catch {}

        try {
            const payload: any = {
                title,
                description: description || '',
                location,
                startDate: startDateStr,
                endDate: endDateStr,
                startTimeOnly: startTimeStr,
                endTimeOnly: endTimeStr,
                maxParticipants,
                status: status as any,
                eligibleOrganizations: eligibleOrganizations as any,
                updatedAt: new Date(),
                registrationOpen: registrationOpen
            };

            if (isSuperAdmin) {
                if (organizerId) payload.organizerId = organizerId;
            } else {
                if (organizerId && currentOrganizerId && organizerId !== currentOrganizerId) {
                    return { error: 'เฉพาะ SuperAdmin เท่านั้นที่แก้หน่วยงานผู้จัดได้' } as const;
                }
            }

            await db.update(activities).set(payload).where(eq(activities.id, params.id));
        } catch (e) {
            // Allow SvelteKit Redirect objects to pass through
            if (e && typeof e === 'object' && 'status' in (e as any) && 'location' in (e as any)) {
                throw e as any;
            }
            console.error('Update activity error:', e);
            return { error: 'อัปเดตกิจกรรมไม่สำเร็จ' } as const;
        }
        
        throw redirect(302, `/admin/activities/${params.id}`);
        }
};
