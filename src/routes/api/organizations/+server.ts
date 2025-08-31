import { json } from '@sveltejs/kit';
import { db, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

function verifyToken(token: string) {
	try {
		return jwt.verify(token, env.JWT_SECRET!) as any;
	} catch {
		return null;
	}
}

export const GET = async ({ cookies }: { cookies: any }) => {
	try {
		// Get all active organizations (no auth required for basic list)
		const facultiesList = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				code: organizations.code,
				description: organizations.description,
				status: organizations.status,
				createdAt: organizations.createdAt,
				updatedAt: organizations.updatedAt
			})
			.from(organizations)
			.where(eq(organizations.status, true))
			.orderBy(organizations.name);

		return json({
			success: true,
			data: facultiesList
		});
	} catch (error) {
		console.error('Get organizations error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};

export const POST = async ({ request, cookies }: { request: any; cookies: any }) => {
	try {
		const token = cookies.get('session_token');
		if (!token) {
			return json(
				{
					success: false,
					error: { code: 'NO_SESSION', message: 'Authentication required' }
				},
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		if (!decoded || !decoded.is_admin || decoded.admin_level !== 'super_admin') {
			return json(
				{
					success: false,
					error: { code: 'UNAUTHORIZED', message: 'Super admin access required' }
				},
				{ status: 403 }
			);
		}

		const facultyData = await request.json();
		const { name, code, description } = facultyData;

		// Validate required fields
		if (!name || !code) {
			return json(
				{
					success: false,
					error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' }
				},
				{ status: 400 }
			);
		}

		// Check if organization code already exists
		const existingFaculty = await db
			.select()
			.from(organizations)
			.where(eq(organizations.code, code))
			.limit(1);

		if (existingFaculty.length > 0) {
			return json(
				{
					success: false,
					error: {
						code: 'ORGANIZATION_EXISTS',
						message: 'Organization with this code already exists'
					}
				},
				{ status: 409 }
			);
		}

		// Create organization
		const newFaculty = await db
			.insert(organizations)
			.values({
				name,
				code,
				description: description || null,
				status: true,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({
				id: organizations.id,
				name: organizations.name,
				code: organizations.code,
				description: organizations.description,
				status: organizations.status,
				createdAt: organizations.createdAt,
				updatedAt: organizations.updatedAt
			});

		return json({
			success: true,
			data: newFaculty[0]
		});
	} catch (error) {
		console.error('Create faculty error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};
