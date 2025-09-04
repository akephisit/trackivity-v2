import type { PageServerLoad, Actions } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import bcrypt from 'bcrypt';

/**
 * Profile update validation schema
 */
const profileUpdateSchema = z.object({
	first_name: z.string().min(1, 'ชื่อจำเป็น').max(100, 'ชื่อยาวเกินไป'),
	last_name: z.string().min(1, 'นามสกุลจำเป็น').max(100, 'นามสกุลยาวเกินไป'),
	email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(255, 'อีเมลยาวเกินไป'),
	phone: z.string().optional().transform(val => val?.trim() || null),
	address: z.string().optional().transform(val => val?.trim() || null)
});

/**
 * Password change validation schema
 */
const passwordChangeSchema = z.object({
	current_password: z.string().min(1, 'รหุสผ่านปัจจุบันจำเป็น'),
	new_password: z.string().min(6, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร').max(255, 'รหัสผ่านยาวเกินไป'),
	confirm_password: z.string().min(1, 'ยืนยันรหัสผ่านจำเป็น')
}).refine((data) => data.new_password === data.confirm_password, {
	message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
	path: ['confirm_password']
});

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { depends } = event;
	depends('profile:data');

	try {
		// Load complete user data from database
		const [userProfile] = await db
			.select({
				id: users.id,
				student_id: users.studentId,
				email: users.email,
				first_name: users.firstName,
				last_name: users.lastName,
				prefix: users.prefix,
				department_id: users.departmentId,
				status: users.status,
				created_at: users.createdAt,
				updated_at: users.updatedAt
			})
			.from(users)
			.where(eq(users.id, user.user_id));

		if (!userProfile) {
			throw new Error('User profile not found');
		}

		return {
			user: userProfile
		};
	} catch (error) {
		console.error('Failed to load user profile:', error);
		throw new Error('Failed to load profile data');
	}
};

export const actions: Actions = {
	/**
	 * Update user profile information
	 */
	updateProfile: async ({ request, locals }) => {
		try {
			if (!locals.user) {
				return fail(401, { error: 'Authentication required' });
			}

			const formData = await request.formData();
			const data = Object.fromEntries(formData);

			// Validate input data
			const validationResult = profileUpdateSchema.safeParse(data);
			if (!validationResult.success) {
				const fieldErrors: Record<string, string[]> = {};
				validationResult.error.issues.forEach((issue) => {
					const field = issue.path[0] as string;
					if (!fieldErrors[field]) fieldErrors[field] = [];
					fieldErrors[field].push(issue.message);
				});

				return fail(400, {
					error: 'Validation failed',
					fieldErrors,
					data
				});
			}

			const { first_name, last_name, email, phone, address } = validationResult.data;

			// Check if email is already taken by another user
			if (email !== locals.user.email) {
				const existingUser = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.email, email))
					.limit(1);

				if (existingUser.length > 0 && existingUser[0].id !== locals.user.id) {
					return fail(400, {
						error: 'Email already exists',
						fieldErrors: { email: ['อีเมลนี้ถูกใช้งานแล้ว'] },
						data
					});
				}
			}

			// Update user profile in database
			await db
				.update(users)
				.set({
					firstName: first_name,
					lastName: last_name,
					email: email,
					// Note: phone and address fields don't exist in current schema
					// They would need to be added to the users table
					updatedAt: new Date()
				})
				.where(eq(users.id, locals.user.id));

			return {
				success: true,
				message: 'บันทึกข้อมูลส่วนตัวสำเร็จ'
			};
		} catch (error) {
			console.error('Profile update error:', error);
			return fail(500, {
				error: 'Failed to update profile',
				message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง'
			});
		}
	},

	/**
	 * Change user password
	 */
	changePassword: async ({ request, locals }) => {
		try {
			if (!locals.user) {
				return fail(401, { error: 'Authentication required' });
			}

			const formData = await request.formData();
			const data = Object.fromEntries(formData);

			// Validate input data
			const validationResult = passwordChangeSchema.safeParse(data);
			if (!validationResult.success) {
				const fieldErrors: Record<string, string[]> = {};
				validationResult.error.issues.forEach((issue) => {
					const field = issue.path[0] as string;
					if (!fieldErrors[field]) fieldErrors[field] = [];
					fieldErrors[field].push(issue.message);
				});

				return fail(400, {
					error: 'Validation failed',
					fieldErrors,
					data
				});
			}

			const { current_password, new_password } = validationResult.data;

			// Get current user's password hash
			const [user] = await db
				.select({ passwordHash: users.passwordHash })
				.from(users)
				.where(eq(users.id, locals.user.id));

			if (!user) {
				return fail(404, {
					error: 'User not found',
					message: 'ไม่พบข้อมูลผู้ใช้'
				});
			}

			// Verify current password
			const isValidPassword = await bcrypt.compare(current_password, user.passwordHash);
			if (!isValidPassword) {
				return fail(400, {
					error: 'Invalid current password',
					fieldErrors: { current_password: ['รหัสผ่านปัจจุบันไม่ถูกต้อง'] },
					data
				});
			}

			// Hash new password
			const saltRounds = 12;
			const hashedPassword = await bcrypt.hash(new_password, saltRounds);

			// Update password in database
			await db
				.update(users)
				.set({
					passwordHash: hashedPassword,
					updatedAt: new Date()
				})
				.where(eq(users.id, locals.user.id));

			return {
				success: true,
				message: 'เปลี่ยนรหัสผ่านสำเร็จ'
			};
		} catch (error) {
			console.error('Password change error:', error);
			return fail(500, {
				error: 'Failed to change password',
				message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองอีกครั้ง'
			});
		}
	}
};