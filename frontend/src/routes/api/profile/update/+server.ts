import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
		}

		const { first_name, last_name, email } = await request.json();

		// Validate input
		if (!first_name || !last_name || !email) {
			return json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
		}

		// Check if email is already taken by another user
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (existingUser.length > 0 && existingUser[0].id !== locals.user.id) {
			return json({ message: 'อีเมลนี้ถูกใช้แล้ว' }, { status: 400 });
		}

		// Update user profile
		await db
			.update(users)
			.set({
				firstName: first_name,
				lastName: last_name, 
				email,
				updated_at: new Date()
			})
			.where(eq(users.id, locals.user.id));

		return json({ message: 'อัปเดตข้อมูลสำเร็จ' });
	} catch (error) {
		console.error('Profile update error:', error);
		return json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
	}
};