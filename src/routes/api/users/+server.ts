import { json } from '@sveltejs/kit';
import { db, users, departments, organizations } from '$lib/server/db';
import { eq, like, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JWT_SECRET } from '$env/static/private';

// Helper function to verify JWT and get user info
function verifyToken(token: string) {
	try {
		return jwt.verify(token, JWT_SECRET) as any;
	} catch {
		return null;
	}
}

export const GET = async ({ url, cookies }: { url: any; cookies: any }) => {
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
		if (!decoded || !decoded.is_admin) {
			return json(
				{
					success: false,
					error: { code: 'UNAUTHORIZED', message: 'Admin access required' }
				},
				{ status: 403 }
			);
		}

		// Parse query parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const perPage = parseInt(url.searchParams.get('per_page') || '20');
		const search = url.searchParams.get('search');
		const facultyId = url.searchParams.get('faculty_id');
		const departmentId = url.searchParams.get('department_id');

		const offset = (page - 1) * perPage;

		// Build query conditions
		const conditions = [];
		if (search) {
			conditions.push(
				sql`(${users.firstName} ILIKE ${`%${search}%`} OR ${users.lastName} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`} OR ${users.studentId} ILIKE ${`%${search}%`})`
			);
		}
		if (departmentId) {
			conditions.push(eq(users.departmentId, departmentId));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get users with department and faculty info
		const usersList = await db
			.select({
				id: users.id,
				studentId: users.studentId,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				departmentId: users.departmentId,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
				department: {
					id: departments.id,
					name: departments.name,
					code: departments.code,
					organizationId: departments.organizationId
				},
				organization: {
					id: organizations.id,
					name: organizations.name,
					code: organizations.code
				}
			})
			.from(users)
			.leftJoin(departments, eq(users.departmentId, departments.id))
			.leftJoin(organizations, eq(departments.organizationId, organizations.id))
			.where(whereClause)
			.limit(perPage)
			.offset(offset);

		// Get total count
		const totalCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.leftJoin(departments, eq(users.departmentId, departments.id))
			.where(whereClause);

		const total = totalCount[0]?.count || 0;

		return json({
			success: true,
			data: usersList,
			pagination: {
				page,
				per_page: perPage,
				total,
				total_pages: Math.ceil(total / perPage)
			}
		});
	} catch (error) {
		console.error('Get users error:', error);
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
		if (!decoded || !decoded.is_admin) {
			return json(
				{
					success: false,
					error: { code: 'UNAUTHORIZED', message: 'Admin access required' }
				},
				{ status: 403 }
			);
		}

		const userData = await request.json();
		const { student_id, email, password, first_name, last_name, department_id } = userData;

		// Validate required fields
		if (!student_id || !email || !password || !first_name || !last_name) {
			return json(
				{
					success: false,
					error: { code: 'VALIDATION_ERROR', message: 'All fields are required' }
				},
				{ status: 400 }
			);
		}

		// Check if user already exists
		const existingUser = await db
			.select()
			.from(users)
			.where(sql`${users.email} = ${email} OR ${users.studentId} = ${student_id}`)
			.limit(1);

		if (existingUser.length > 0) {
			return json(
				{
					success: false,
					error: {
						code: 'USER_EXISTS',
						message: 'User with this email or student ID already exists'
					}
				},
				{ status: 409 }
			);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Generate QR secret
		const qrSecret = crypto.randomUUID();

		// Create user
		const newUser = await db
			.insert(users)
			.values({
				studentId: student_id,
				email,
				passwordHash,
				firstName: first_name,
				lastName: last_name,
				departmentId: department_id || null,
				qrSecret,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({
				id: users.id,
				studentId: users.studentId,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				departmentId: users.departmentId,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt
			});

		return json({
			success: true,
			data: newUser[0]
		});
	} catch (error) {
		console.error('Create user error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};
