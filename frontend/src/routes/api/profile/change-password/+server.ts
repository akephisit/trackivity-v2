import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
		}

		const { current_password, new_password, confirm_password } = await request.json();

		// Validate input
		if (!current_password || !new_password || !confirm_password) {
			return json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
		}

		if (new_password !== confirm_password) {
			return json({ message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' }, { status: 400 });
		}

		if (new_password.length < 6) {
			return json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
		}

		// Get current user with password
		const currentUser = await db
			.select({
				id: users.id,
				passwordHash: users.passwordHash
			})
			.from(users)
			.where(eq(users.id, locals.user.id))
			.limit(1);

		if (currentUser.length === 0) {
			return json({ message: 'ไม่พบผู้ใช้' }, { status: 404 });
		}

		// Verify current password
		const isCurrentPasswordValid = await argon2.verify(
			currentUser[0].passwordHash,
			current_password
		);

		if (!isCurrentPasswordValid) {
			return json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
		}

		// Hash new password
		const newPasswordHash = await argon2.hash(new_password);

		// Update password
		await db
			.update(users)
			.set({
				passwordHash: newPasswordHash,
				updated_at: new Date()
			})
			.where(eq(users.id, locals.user.id));

		return json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
	} catch (error) {
		console.error('Password change error:', error);
		return json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
	}
};