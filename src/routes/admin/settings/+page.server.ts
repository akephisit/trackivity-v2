import { error, fail, redirect } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { organizationActivityRequirements, organizations } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const activityRequirementsSchema = z.object({
	requiredFacultyHours: z.number().min(0).max(1000),
	requiredUniversityHours: z.number().min(0).max(1000)
});

export const load: ServerLoad = async (event) => {
	const { requireOrganizationAdmin } = await import('$lib/server/auth-utils');
	
	// Get authenticated user and ensure they have OrganizationAdmin privileges
	const user = requireOrganizationAdmin(event);
	
	// Get organization ID from admin role
	const organizationId = user.admin_role?.organization_id;
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

		const requirements = await db
			.select()
			.from(organizationActivityRequirements)
			.where(eq(organizationActivityRequirements.organizationId, organizationId))
			.limit(1);

		const currentRequirements = requirements[0] || {
			requiredFacultyHours: 0,
			requiredUniversityHours: 0
		};

		return {
			user,
			organization: organization[0],
			currentRequirements
		};
	} catch (err) {
		console.error('Failed to load settings:', err);
		throw error(500, 'Failed to load settings');
	}
};

export const actions: Actions = {
	updateRequirements: async (event) => {
		const { request } = event;
		const { requireOrganizationAdmin } = await import('$lib/server/auth-utils');
		
		// Get authenticated user and ensure they have OrganizationAdmin privileges
		const user = requireOrganizationAdmin(event);
		
		// Get organization ID from admin role
		const organizationId = user.admin_role?.organization_id;
		if (!organizationId) {
			return fail(400, { error: 'Organization ID not found' });
		}

		try {
			const formData = await request.formData();
			const data = {
				requiredFacultyHours: Number(formData.get('requiredFacultyHours')),
				requiredUniversityHours: Number(formData.get('requiredUniversityHours'))
			};

			const validatedData = activityRequirementsSchema.parse(data);
			const userId = user.user_id;

			await db.transaction(async (tx) => {
				// Check if requirement already exists
				const existing = await tx
					.select()
					.from(organizationActivityRequirements)
					.where(eq(organizationActivityRequirements.organizationId, organizationId))
					.limit(1);

				if (existing.length > 0) {
					// Update existing requirement
					await tx
						.update(organizationActivityRequirements)
						.set({
							requiredFacultyHours: validatedData.requiredFacultyHours,
							requiredUniversityHours: validatedData.requiredUniversityHours,
							updatedAt: new Date()
						})
						.where(eq(organizationActivityRequirements.organizationId, organizationId));
				} else {
					// Create new requirement
					await tx.insert(organizationActivityRequirements).values({
						organizationId,
						requiredFacultyHours: validatedData.requiredFacultyHours,
						requiredUniversityHours: validatedData.requiredUniversityHours,
						createdBy: userId
					});
				}
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