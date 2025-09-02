import { error, fail, redirect } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { organizationActivityRequirements, organizations } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const activityRequirementsSchema = z.object({
	requiredFacultyHours: z.number().min(0).max(1000),
	requiredUniversityHours: z.number().min(0).max(1000),
	academicYear: z.string().min(1).max(20)
});

export const load: ServerLoad = async ({ locals }: { locals: any }) => {
	const session = locals.session;
	
	if (!session?.user?.id || !session?.adminRole) {
		throw redirect(302, '/admin/login');
	}

	if (session.adminRole.adminLevel !== 'OrganizationAdmin') {
		throw error(403, 'Access denied. Only organization admins can access settings.');
	}

	const organizationId = session.adminRole.organizationId;
	if (!organizationId) {
		throw error(400, 'Organization ID not found.');
	}

	try {
		const organization = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		if (!organization[0]) {
			throw error(404, 'Organization not found.');
		}

		if (organization[0].organizationType !== 'faculty') {
			throw error(403, 'Settings are only available for faculty organizations.');
		}

		const currentYear = new Date().getFullYear().toString();
		const requirements = await db
			.select()
			.from(organizationActivityRequirements)
			.where(
				and(
					eq(organizationActivityRequirements.organizationId, organizationId),
					eq(organizationActivityRequirements.academicYear, currentYear),
					eq(organizationActivityRequirements.isActive, true)
				)
			)
			.limit(1);

		const currentRequirements = requirements[0] || {
			requiredFacultyHours: 0,
			requiredUniversityHours: 0,
			academicYear: currentYear
		};

		return {
			organization: organization[0],
			currentRequirements,
			currentAcademicYear: currentYear
		};
	} catch (err) {
		console.error('Failed to load settings:', err);
		throw error(500, 'Failed to load settings');
	}
};

export const actions: Actions = {
	updateRequirements: async ({ request, locals }: { request: Request; locals: any }) => {
		const session = locals.session;
		
		if (!session?.user?.id || !session?.adminRole) {
			return fail(401, { error: 'Unauthorized' });
		}

		if (session.adminRole.adminLevel !== 'OrganizationAdmin') {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const organizationId = session.adminRole.organizationId;
		if (!organizationId) {
			return fail(400, { error: 'Organization ID not found' });
		}

		try {
			const formData = await request.formData();
			const data = {
				requiredFacultyHours: Number(formData.get('requiredFacultyHours')),
				requiredUniversityHours: Number(formData.get('requiredUniversityHours')),
				academicYear: formData.get('academicYear')?.toString() || new Date().getFullYear().toString()
			};

			const validatedData = activityRequirementsSchema.parse(data);
			const userId = session.user.id;

			await db.transaction(async (tx) => {
				await tx
					.update(organizationActivityRequirements)
					.set({ isActive: false })
					.where(
						and(
							eq(organizationActivityRequirements.organizationId, organizationId),
							eq(organizationActivityRequirements.academicYear, validatedData.academicYear)
						)
					);

				await tx.insert(organizationActivityRequirements).values({
					organizationId,
					requiredFacultyHours: validatedData.requiredFacultyHours,
					requiredUniversityHours: validatedData.requiredUniversityHours,
					academicYear: validatedData.academicYear,
					createdBy: userId,
					isActive: true
				});
			});

			return {
				success: true,
				message: 'การตั้งค่าจำนวนชั่วโมงสะสมได้รับการอัพเดทเรียบร้อยแล้ว'
			};
		} catch (err) {
			console.error('Failed to update requirements:', err);
			
			if (err instanceof z.ZodError) {
				return fail(400, { 
					error: 'ข้อมูลไม่ถูกต้อง',
					details: err.errors 
				});
			}

			return fail(500, { error: 'เกิดข้อผิดพลาดในการอัพเดทการตั้งค่า' });
		}
	}
};