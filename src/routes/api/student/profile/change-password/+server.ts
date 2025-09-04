import { json } from '@sveltejs/kit';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

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
 * Password change validation schema
 */
const changePasswordSchema = z.object({
	current_password: z.string().min(1, 'รหัสผ่านปัจจุบันจำเป็น'),
	new_password: z.string()
		.min(8, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร')
		.max(128, 'รหัสผ่านยาวเกินไป')
		.refine((password) => {
			// Password must contain at least one letter and one number
			return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
		}, 'รหัสผ่านต้องมีตัวอักษรและตัวเลขอย่างน้อย 1 ตัว'),
	confirm_password: z.string()
}).refine((data) => data.new_password === data.confirm_password, {
	message: 'การยืนยันรหัสผ่านไม่ตรงกัน',
	path: ['confirm_password']
});

/**
 * POST /api/student/profile/change-password - Change current student's password
 */
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
		const validation = changePasswordSchema.safeParse(requestData);
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

		// Get current user
		const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

		if (currentUser.length === 0) {
			return json(
				{
					success: false,
					error: { code: 'USER_NOT_FOUND', message: 'User not found' }
				},
				{ status: 404 }
			);
		}

		// Verify current password
		const isCurrentPasswordValid = await argon2.verify(
			currentUser[0].passwordHash,
			validData.current_password
		);

		if (!isCurrentPasswordValid) {
			return json(
				{
					success: false,
					error: { 
						code: 'INVALID_PASSWORD', 
						message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
						field_errors: { current_password: ['รหัสผ่านปัจจุบันไม่ถูกต้อง'] }
					}
				},
				{ status: 400 }
			);
		}

		// Hash new password
		const newPasswordHash = await argon2.hash(validData.new_password);

		// Update password
		await db
			.update(users)
			.set({
				passwordHash: newPasswordHash,
				updatedAt: new Date()
			})
			.where(eq(users.id, userId));

		return json({
			success: true,
			message: 'เปลี่ยนรหัสผ่านสำเร็จ'
		});
	} catch (error) {
		console.error('Change password error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};