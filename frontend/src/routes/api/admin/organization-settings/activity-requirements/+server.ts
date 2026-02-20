import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { organizationActivityRequirements } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const activityRequirementsSchema = z.object({
	requiredFacultyHours: z.number().min(0).max(1000),
	requiredUniversityHours: z.number().min(0).max(1000)
});

export const GET: RequestHandler = async ({ url, locals }: { url: URL; locals: any }) => {
	try {
		const session = locals.session;
		if (!session?.user?.id || !session?.adminRole?.organizationId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const organizationId = session.adminRole.organizationId;

		const requirements = await db
			.select()
			.from(organizationActivityRequirements)
			.where(eq(organizationActivityRequirements.organizationId, organizationId))
			.limit(1);

		const requirement = requirements[0] || {
			requiredFacultyHours: 0,
			requiredUniversityHours: 0
		};

		return json({ data: requirement });
	} catch (error) {
		console.error('Failed to fetch activity requirements:', error);
		return json({ error: 'Failed to fetch activity requirements' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({
	request,
	locals
}: {
	request: Request;
	locals: any;
}) => {
	try {
		const session = locals.session;
		if (!session?.user?.id || !session?.adminRole?.organizationId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (session.adminRole.adminLevel !== 'OrganizationAdmin') {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		const data = await request.json();
		const validatedData = activityRequirementsSchema.parse(data);

		const organizationId = session.adminRole.organizationId;
		const userId = session.user.id;

		await db.transaction(async (tx: any) => {
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
						updated_at: new Date()
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

		return json({
			data: {
				...validatedData,
				organizationId
			},
			message: 'Activity requirements updated successfully'
		});
	} catch (error) {
		console.error('Failed to update activity requirements:', error);

		if (error instanceof z.ZodError) {
			return json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
		}

		return json({ error: 'Failed to update activity requirements' }, { status: 500 });
	}
};
