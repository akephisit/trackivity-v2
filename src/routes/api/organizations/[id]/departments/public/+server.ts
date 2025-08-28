import { json, type RequestHandler } from '@sveltejs/kit';
import { db, departments } from '$lib/server/db';
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

		const rows = await db
			.select({
				id: departments.id,
				name: departments.name,
				code: departments.code,
				organization_id: departments.organizationId,
				description: departments.description,
				status: departments.status,
				created_at: departments.createdAt,
				updated_at: departments.updatedAt
			})
			.from(departments)
			.where(and(eq(departments.organizationId, organizationId), eq(departments.status, true)))
			.orderBy(departments.name);

		const data = rows.map((d) => ({
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
