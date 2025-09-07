import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import {
	db,
	activities,
	organizations,
	users as dbUsers,
	departments,
	participations
} from '$lib/server/db';
import { desc, eq, and, ne, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	event.depends('student:activities');

	try {
		// Get user's department and organization for filtering
		const userWithDepartment = await db
			.select({
				userId: dbUsers.id,
				departmentId: dbUsers.departmentId,
				organizationId: departments.organizationId
			})
			.from(dbUsers)
			.leftJoin(departments, eq(dbUsers.departmentId, departments.id))
			.where(eq(dbUsers.id, user.user_id))
			.limit(1);

		const userOrganizationId = userWithDepartment[0]?.organizationId;

		// โหลดกิจกรรมจากฐานข้อมูลโดยตรง พร้อมชื่อหน่วยงานและผู้สร้าง
		// กรองเฉพาะกิจกรรมที่เผยแพร่แล้ว (ไม่ใช่สถานะ draft)
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
				eligible_organizations: activities.eligibleOrganizations,
				created_at: activities.created_at,
				updated_at: activities.updated_at,
				organizer_id: activities.organizerId,
				organization_id: activities.organizationId,
				organization_name: organizations.name,
				creator_first_name: dbUsers.firstName,
				creator_last_name: dbUsers.lastName
			})
			.from(activities)
			.leftJoin(organizations, eq(activities.organizerId, organizations.id))
			.leftJoin(dbUsers, eq(activities.createdBy, dbUsers.id))
			.where(ne(activities.status, 'draft'))
			.orderBy(desc(activities.created_at))
			.limit(100);

		// Get user's participation status for each activity
		const activityIds = rows.map((r) => r.id);
		const userParticipations =
			activityIds.length > 0
				? await db
						.select({
							activityId: participations.activityId,
							status: participations.status,
							registeredAt: participations.registeredAt
						})
						.from(participations)
						.where(
							and(
								eq(participations.userId, user.user_id),
								inArray(participations.activityId, activityIds)
							)
						)
				: [];

		// Create participation map for quick lookup
		const participationMap = new Map(userParticipations.map((p) => [p.activityId, p]));

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

		const list = rows.map((r) => {
			const participation = participationMap.get(r.id);
			const eligibleOrgs = Array.isArray(r.eligible_organizations) ? r.eligible_organizations : [];

			// Check if user's organization is eligible for this activity
			const isEligible =
				!eligibleOrgs.length || // If no restrictions, everyone can join
				(userOrganizationId && eligibleOrgs.includes(userOrganizationId));

			return {
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
				participant_count: r.participant_count || 0,
				created_at: r.created_at,
				updated_at: r.updated_at,
				organization_id: r.organization_id || r.organizer_id || undefined,
				organization_name: r.organization_name || undefined,
				created_by_name: [r.creator_first_name, r.creator_last_name].filter(Boolean).join(' '),
				is_registered: !!participation,
				user_participation_status: participation?.status,
				is_eligible: isEligible,
				eligible_organizations: eligibleOrgs
			};
		});

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
