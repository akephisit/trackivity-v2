import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, activities, organizations } from '$lib/server/db';
import { alias } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);

	const searchParams = event.url.searchParams;
	const selectedActivityId = searchParams.get('activity_id') || undefined;

	// Build admin info block
	let facultyName: string | undefined = undefined;
	const facultyId = (user.admin_role as any)?.organization_id || undefined;
	if (facultyId) {
		try {
			const rows = await db
				.select({ id: organizations.id, name: organizations.name })
				.from(organizations)
				.where(eq(organizations.id, facultyId));
			facultyName = rows[0]?.name;
		} catch (e) {
			// Best effort only; keep facultyName undefined on error
			console.error('[qr-scanner] failed to load faculty name', e);
		}
	}

	// Query only ongoing activities; if FacultyAdmin, scope by faculty
	const whereClause =
		user.admin_role?.admin_level === 'OrganizationAdmin' && facultyId
			? and(eq(activities.status, 'ongoing'), eq(activities.organizationId, facultyId))
			: eq(activities.status, 'ongoing');

  const orgOrganizer = alias(organizations, 'org_organizer');
  const rows = await db
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
      faculty_id: activities.organizationId,
      organizer_id: activities.organizerId,
      organizer: orgOrganizer.name
    })
    .from(activities)
    .leftJoin(orgOrganizer, eq(activities.organizerId, orgOrganizer.id))
    .where(whereClause);

	const admin = {
		first_name: user.first_name,
		last_name: user.last_name,
		admin_level: user.admin_role?.admin_level || 'RegularAdmin',
		faculty_id: facultyId,
		faculty_name: facultyName
	};

	return {
		admin,
		activities: rows,
		selectedActivityId
	};
};
