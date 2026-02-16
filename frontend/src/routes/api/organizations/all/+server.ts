import { json } from '@sveltejs/kit';
import { db, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET = async () => {
	try {
		// Get all active organizations, both faculty and office types
		const allOrganizations = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				code: organizations.code,
				description: organizations.description,
				status: organizations.status,
				organizationType: organizations.organizationType,
				created_at: organizations.created_at,
				updated_at: organizations.updated_at
			})
			.from(organizations)
			.where(eq(organizations.status, true))
			.orderBy(organizations.organizationType, organizations.name);

		// Group organizations by type for better categorization
		const groupedOrganizations = {
			faculty: allOrganizations.filter((org) => org.organizationType === 'faculty'),
			office: allOrganizations.filter((org) => org.organizationType === 'office')
		};

		return json({
			success: true,
			data: {
				all: allOrganizations,
				grouped: groupedOrganizations
			}
		});
	} catch (error) {
		console.error('Get all organizations error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};
