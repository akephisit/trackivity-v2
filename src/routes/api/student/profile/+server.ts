import { json } from '@sveltejs/kit';
import { db, users, departments, organizations, adminRoles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { PrefixOptions } from '$lib/schemas/auth';

/**
 * JWT token verification utility
 */
function verifyToken(token: string) {
	try {
		return jwt.verify(token, env.JWT_SECRET!) as any;
	} catch {
		return null;
	}
}

/**
 * Profile update validation schema
 */
const updateProfileSchema = z.object({
	prefix: z
		.string()
		.min(1, 'กรุณาเลือกคำนำหน้า')
		.refine((val) => PrefixOptions.some((option) => option.value === val), {
			message: 'กรุณาเลือกคำนำหน้าที่ถูกต้อง'
		}),
	first_name: z.string().min(1, 'ชื่อจำเป็น').max(100, 'ชื่อยาวเกินไป'),
	last_name: z.string().min(1, 'นามสกุลจำเป็น').max(100, 'นามสกุลยาวเกินไป'),
	email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(255, 'อีเมลยาวเกินไป'),
	phone: z.string().optional().refine((phone) => {
		if (!phone || phone.trim() === '') return true;
		// Thai phone number validation (10 digits, starting with 0)
		const phoneRegex = /^0[0-9]{9}$/;
		return phoneRegex.test(phone.replace(/[^\d]/g, ''));
	}, 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 10 หลัก เริ่มด้วย 0)'),
	address: z.string().max(500, 'ที่อยู่ยาวเกินไป').optional()
});


/**
 * GET /api/student/profile - Get current student's profile
 */
export const GET = async ({ cookies }: { cookies: any }) => {
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
		if (!decoded) {
			return json(
				{
					success: false,
					error: { code: 'INVALID_SESSION', message: 'Invalid session' }
				},
				{ status: 401 }
			);
		}

		const userId = decoded.user_id;

		// Get user with department and organization info, plus admin role if exists
		const userResult = await db
			.select({
				id: users.id,
				studentId: users.studentId,
				email: users.email,
				prefix: users.prefix,
				firstName: users.firstName,
				lastName: users.lastName,
				phone: users.phone,
				address: users.address,
				status: users.status,
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
				},
				adminRole: {
					id: adminRoles.id,
					adminLevel: adminRoles.adminLevel,
					organizationId: adminRoles.organizationId,
					permissions: adminRoles.permissions,
					isEnabled: adminRoles.isEnabled
				}
			})
			.from(users)
			.leftJoin(departments, eq(users.departmentId, departments.id))
			.leftJoin(organizations, eq(departments.organizationId, organizations.id))
			.leftJoin(adminRoles, eq(users.id, adminRoles.userId))
			.where(eq(users.id, userId))
			.limit(1);

		if (userResult.length === 0) {
			return json(
				{
					success: false,
					error: { code: 'USER_NOT_FOUND', message: 'User not found' }
				},
				{ status: 404 }
			);
		}

		const user = userResult[0];

		// Format response to match SessionUser interface
		const sessionUser = {
			user_id: user.id,
			student_id: user.studentId,
			email: user.email,
			prefix: user.prefix,
			first_name: user.firstName,
			last_name: user.lastName,
			phone: user.phone || undefined,
			address: user.address || undefined,
			department_id: user.departmentId || undefined,
			organization_id: user.organization?.id || undefined,
			organization_name: user.organization?.name || undefined,
			department_name: user.department?.name || undefined,
			admin_role: user.adminRole?.id ? {
				id: user.adminRole.id,
				admin_level: user.adminRole.adminLevel as any,
				organization_id: user.adminRole.organizationId || undefined,
				permissions: user.adminRole.permissions || [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			} : undefined,
			session_id: decoded.session_id || '',
			permissions: user.adminRole?.permissions || ['ViewPersonalQR', 'ViewPersonalHistory'],
			expires_at: new Date(decoded.exp * 1000).toISOString(),
			created_at: user.createdAt?.toISOString(),
			updated_at: user.updatedAt?.toISOString()
		};

		return json({
			success: true,
			data: sessionUser
		});
	} catch (error) {
		console.error('Get student profile error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};

/**
 * PATCH /api/student/profile - Update current student's profile
 */
export const PATCH = async ({ request, cookies }: { request: any; cookies: any }) => {
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
		if (!decoded) {
			return json(
				{
					success: false,
					error: { code: 'INVALID_SESSION', message: 'Invalid session' }
				},
				{ status: 401 }
			);
		}

		const userId = decoded.user_id;
		const requestData = await request.json();

		// Validate input data
		const validation = updateProfileSchema.safeParse(requestData);
		if (!validation.success) {
			const fieldErrors: Record<string, string[]> = {};
			validation.error.errors.forEach((err) => {
				const field = err.path.join('.');
				if (!fieldErrors[field]) {
					fieldErrors[field] = [];
				}
				fieldErrors[field].push(err.message);
			});

			return json(
				{
					success: false,
					error: { 
						code: 'VALIDATION_ERROR', 
						message: 'ข้อมูลไม่ถูกต้อง',
						field_errors: fieldErrors
					}
				},
				{ status: 400 }
			);
		}

		const validData = validation.data;

		// Check if user exists
		const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

		if (existingUser.length === 0) {
			return json(
				{
					success: false,
					error: { code: 'USER_NOT_FOUND', message: 'User not found' }
				},
				{ status: 404 }
			);
		}

		// Check if email is already taken by another user
		if (validData.email !== existingUser[0].email) {
			const emailExists = await db
				.select()
				.from(users)
				.where(eq(users.email, validData.email))
				.limit(1);

			if (emailExists.length > 0 && emailExists[0].id !== userId) {
				return json(
					{
						success: false,
						error: { 
							code: 'EMAIL_TAKEN', 
							message: 'อีเมลนี้ถูกใช้งานแล้ว',
							field_errors: { email: ['อีเมลนี้ถูกใช้งานแล้ว'] }
						}
					},
					{ status: 409 }
				);
			}
		}

		// Prepare update data
		const updateData: any = {
			prefix: validData.prefix,
			firstName: validData.first_name,
			lastName: validData.last_name,
			email: validData.email,
			phone: validData.phone?.trim() || null,
			address: validData.address?.trim() || null,
			updatedAt: new Date()
		};

		// Update user profile
		const updatedUser = await db
			.update(users)
			.set(updateData)
			.where(eq(users.id, userId))
			.returning({
				id: users.id,
				studentId: users.studentId,
				email: users.email,
				prefix: users.prefix,
				firstName: users.firstName,
				lastName: users.lastName,
				phone: users.phone,
				address: users.address,
				updatedAt: users.updatedAt
			});

		return json({
			success: true,
			data: {
				user_id: updatedUser[0].id,
				student_id: updatedUser[0].studentId,
				email: updatedUser[0].email,
				prefix: updatedUser[0].prefix,
				first_name: updatedUser[0].firstName,
				last_name: updatedUser[0].lastName,
				phone: updatedUser[0].phone,
				address: updatedUser[0].address,
				updated_at: updatedUser[0].updatedAt?.toISOString()
			},
			message: 'อัพเดตข้อมูลส่วนตัวสำเร็จ'
		});
	} catch (error) {
		console.error('Update student profile error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};

