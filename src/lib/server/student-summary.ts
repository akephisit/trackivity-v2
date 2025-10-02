import {
	db,
	participations,
	activities,
	organizations,
	organizationActivityRequirements,
	users,
	departments
} from '$lib/server/db';
import type { SessionUser } from '$lib/types';
import { eq } from 'drizzle-orm';

type ParticipationRecord = {
	id: string;
	activity_id: string | null;
	user_id: string;
	participated_at: string;
	registered_at: string | null;
	checked_in_at: string | null;
	checked_out_at: string | null;
	status: string | null;
	notes: string | null;
	activity: {
		id: string | null;
		title: string | null;
		description: string;
		activity_type: string;
		location: string;
		start_date: any;
		end_date: any;
		start_time: string | null;
		end_time: string | null;
		hours: number | null;
		status: string | null;
		organizer_name: string | null;
		activity_level: string | null;
	};
};

type ActivityRequirements = {
	requiredFacultyHours: number | null;
	requiredUniversityHours: number | null;
};

export type StudentSummary = {
	participationHistory: ParticipationRecord[];
	userInfo: {
		student_id: string;
		first_name: string;
		last_name: string;
		email: string;
		department_name?: string | null;
		organization_name?: string | null;
	} | null;
	activityRequirements: ActivityRequirements | null;
};

const toISO = (value: any | null | undefined): string | null => {
	if (!value) return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	try {
		const d = new Date(value);
		if (!Number.isNaN(d.getTime())) return d.toISOString();
	} catch {
		return String(value);
	}
	return String(value);
};

export async function getStudentSummary(user: SessionUser): Promise<StudentSummary> {
	try {
		const rowsAll = await db
			.select({
				id: participations.id,
				activity_id: participations.activityId,
				user_id: participations.userId,
				registered_at: participations.registeredAt,
				checked_in_at: participations.checkedInAt,
				checked_out_at: participations.checkedOutAt,
				status: participations.status,
				notes: participations.notes,
				a_id: activities.id,
				a_title: activities.title,
				a_description: activities.description,
				a_location: activities.location,
				a_type: activities.activityType,
				a_start_date: activities.startDate,
				a_end_date: activities.endDate,
				a_start_time: activities.startTimeOnly,
				a_end_time: activities.endTimeOnly,
				a_hours: activities.hours,
				a_status: activities.status,
				a_organizer_id: activities.organizerId,
				a_activity_level: activities.activityLevel,
				org_name: organizations.name
			})
			.from(participations)
			.leftJoin(activities, eq(participations.activityId, activities.id))
			.leftJoin(organizations, eq(activities.organizerId, organizations.id))
			.where(eq(participations.userId, user.user_id));

		const participationHistory: ParticipationRecord[] = rowsAll.map((r) => {
			const fallbackDate = r.checked_out_at || r.checked_in_at || r.registered_at || new Date();
			return {
				id: r.id,
				activity_id: r.activity_id,
				user_id: r.user_id,
				participated_at: toISO(fallbackDate) ?? new Date().toISOString(),
				registered_at: toISO(r.registered_at),
				checked_in_at: toISO(r.checked_in_at),
				checked_out_at: toISO(r.checked_out_at),
				status: r.status,
				notes: r.notes,
				activity: {
					id: r.a_id,
					title: r.a_title,
					description: r.a_description || '',
					activity_type: r.a_type || 'Other',
					location: r.a_location || '',
					start_date: r.a_start_date,
					end_date: r.a_end_date,
					start_time: r.a_start_time,
					end_time: r.a_end_time,
					hours: r.a_hours,
					status: r.a_status,
					organizer_name: r.org_name,
					activity_level: r.a_activity_level
				}
			};
		});

		let activityRequirements: ActivityRequirements | null = null;

		const userRecord = await db
			.select({
				departmentId: users.departmentId,
				departmentName: departments.name,
				organizationId: organizations.id,
				organizationName: organizations.name
			})
			.from(users)
			.leftJoin(departments, eq(users.departmentId, departments.id))
			.leftJoin(organizations, eq(departments.organizationId, organizations.id))
			.where(eq(users.id, user.user_id))
			.limit(1);

		const departmentName = userRecord[0]?.departmentName ?? null;
		const organizationId = userRecord[0]?.organizationId ?? null;
		const organizationName = userRecord[0]?.organizationName ?? null;

		if (organizationId) {
			const requirements = await db
				.select({
					requiredFacultyHours: organizationActivityRequirements.requiredFacultyHours,
					requiredUniversityHours: organizationActivityRequirements.requiredUniversityHours
				})
				.from(organizationActivityRequirements)
				.where(eq(organizationActivityRequirements.organizationId, organizationId))
				.limit(1);

			if (requirements[0]) {
				activityRequirements = {
					requiredFacultyHours: Number(requirements[0].requiredFacultyHours ?? 0),
					requiredUniversityHours: Number(requirements[0].requiredUniversityHours ?? 0)
				};
			}
		}

		return {
			participationHistory,
			userInfo: {
				student_id: user.student_id,
				first_name: user.first_name,
				last_name: user.last_name,
				email: user.email,
				department_name: departmentName,
				organization_name: organizationName
			},
			activityRequirements
		};
	} catch (error) {
		console.error('[Student Summary] getStudentSummary error:', error);
		return {
			participationHistory: [],
			userInfo: {
				student_id: user.student_id,
				first_name: user.first_name,
				last_name: user.last_name,
				email: user.email
			},
			activityRequirements: null
		};
	}
}
