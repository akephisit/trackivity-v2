import { json, type RequestHandler } from '@sveltejs/kit';
import { db, departments, organizations } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

// Public endpoint: list active departments for an organization
export const GET: RequestHandler = async ({ params }) => {
	try {
		const organizationId = params.id;
		if (!organizationId) {
			return json(
				{
					success: false,
					error: { code: 'VALIDATION_ERROR', message: 'organization_id is required' }
				},
				{ status: 400 }
			);
		}

		// First check if the organization exists and is of type 'faculty'
		const [organization] = await db
			.select({
				id: organizations.id,
				organizationType: organizations.organizationType,
				status: organizations.status
			})
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		if (!organization) {
			return json(
				{
					success: false,
					error: { code: 'NOT_FOUND', message: 'Organization not found' }
				},
				{ status: 404 }
			);
		}

		if (!organization.status) {
			return json(
				{
					success: false,
					error: { code: 'INACTIVE_ORGANIZATION', message: 'Organization is inactive' }
				},
				{ status: 400 }
			);
		}

		// Only allow departments for faculty-type organizations
		if (organization.organizationType !== 'faculty') {
			return json(
				{
					success: false,
					error: {
						code: 'ACCESS_DENIED',
						message: 'Departments are only available for faculty organizations'
					}
				},
				{ status: 403 }
			);
		}

		const rows = await db
			.select({
				id: departments.id,
				name: departments.name,
				code: departments.code,
				organization_id: departments.organizationId,
				description: departments.description,
				status: departments.status,
				created_at: departments.created_at,
				updated_at: departments.updated_at
			})
			.from(departments)
			.where(and(eq(departments.organizationId, organizationId), eq(departments.status, true)))
			.orderBy(departments.name);

		const data = rows.map((d: any) => ({
			id: d.id,
			name: d.name,
			code: d.code,
			organization_id: d.organization_id,
			description: d.description || undefined,
			status: !!d.status,
			created_at: d.created_at?.toISOString() || new Date().toISOString(),
			updated_at: d.updated_at?.toISOString() || new Date().toISOString()
		}));

		return json({ success: true, data });
	} catch (error) {
		console.error('Get departments by faculty error:', error);
		return json(
			{ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
			{ status: 500 }
		);
	}
};
