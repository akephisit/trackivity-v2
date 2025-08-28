import { json, type RequestHandler } from '@sveltejs/kit';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface RegisterBody {
	student_id: string;
	email: string;
	password: string;
	prefix?: string;
	first_name: string;
	last_name: string;
	department_id?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Partial<RegisterBody>;
		const { student_id, email, password, first_name, last_name, department_id } = body;

		// Basic validation
		if (!student_id || !email || !password || !first_name || !last_name) {
			return json(
				{
					success: false,
					error: {
						code: 'VALIDATION_ERROR',
						message: 'Missing required fields'
					}
				},
				{ status: 400 }
			);
		}

		// Check duplicates
		const existingByEmail = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		if (existingByEmail.length > 0) {
			return json(
				{
					success: false,
					error: {
						code: 'EMAIL_EXISTS',
						message: 'อีเมลนี้ถูกใช้งานแล้ว'
					}
				},
				{ status: 409 }
			);
		}

		const existingBySid = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.studentId, student_id))
			.limit(1);
		if (existingBySid.length > 0) {
			return json(
				{
					success: false,
					error: {
						code: 'STUDENT_ID_EXISTS',
						message: 'รหัสนักศึกษานี้ถูกใช้งานแล้ว'
					}
				},
				{ status: 409 }
			);
		}

		// Create user
		const passwordHash = await bcrypt.hash(password, 10);
		const qrSecret = crypto.randomBytes(16).toString('hex');

		const [inserted] = await db
			.insert(users)
			.values({
				studentId: student_id,
				email,
				passwordHash,
				firstName: first_name,
				lastName: last_name,
				departmentId: department_id || null,
				qrSecret,
				status: 'active'
			})
			.returning({ id: users.id, email: users.email });

		return json({
			success: true,
			data: {
				id: inserted.id,
				email: inserted.email
			}
		});
	} catch (error) {
		console.error('Register API error:', error);
		return json(
			{
				success: false,
				error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
			},
			{ status: 500 }
		);
	}
};
