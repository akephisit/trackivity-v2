import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { registerSchema } from '$lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';
import type { Organization } from '$lib/types/admin';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import { db, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	// ตรวจสอบว่ามี session อยู่แล้วหรือไม่
	const user = getOptionalAuthUser(event);

	if (user) {
		// User already logged in, redirect based on role
		if (user.admin_role) {
			throw redirect(303, '/admin');
		} else {
			throw redirect(303, '/student');
		}
	}

	// โหลดรายการหน่วยงานจากฐานข้อมูลโดยตรง (เฉพาะคณะเท่านั้น)
	let organizationsList: Organization[] = [];

	try {
		const result = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				code: organizations.code,
				description: organizations.description,
				organizationType: organizations.organizationType,
				status: organizations.status,
				created_at: organizations.createdAt,
				updated_at: organizations.updatedAt
			})
			.from(organizations)
			.where(eq(organizations.status, true))
			.orderBy(organizations.name);

		// Filter only faculty type organizations for student registration
		organizationsList = result
			.filter((o) => o.organizationType === 'faculty')
			.map((o) => ({
				id: o.id,
				name: o.name,
				code: o.code,
				description: o.description || undefined,
				status: !!o.status,
				created_at: o.created_at?.toISOString() || new Date().toISOString(),
				updated_at: o.updated_at?.toISOString() || new Date().toISOString()
			}));
	} catch (error) {
		console.error('Failed to load organizations from database:', error);
		throw new Error('ไม่สามารถโหลดข้อมูลหน่วยงานได้ กรุณาลองใหม่อีกครั้ง');
	}

	const form = await superValidate(zod(registerSchema));

	return {
		form,
		organizations: organizationsList
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request } = event;
		const form = await superValidate(request, zod(registerSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// ส่งข้อมูลการสมัครไปยัง API endpoint โดยตรง
			const response = await event.fetch('/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					student_id: form.data.student_id,
					email: form.data.email,
					password: form.data.password,
					prefix: form.data.prefix,
					first_name: form.data.first_name,
					last_name: form.data.last_name,
					department_id: form.data.department_id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				// การสมัครล้มเหลว
				const errorMessage = result.error?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
				if (errorMessage.includes('student_id')) {
					form.errors.student_id = [errorMessage];
				} else if (errorMessage.includes('email')) {
					form.errors.email = [errorMessage];
				} else {
					form.errors._errors = [errorMessage];
				}
				return fail(400, { form });
			}

			// สมัครสำเร็จ - redirect ไป login พร้อมข้อความแจ้ง
			throw redirect(303, '/login?registered=true');
		} catch (error) {
			// ตรวจสอบว่าเป็น redirect object หรือไม่
			if (
				error instanceof Response ||
				(error && typeof error === 'object' && (error as any).status === 303) ||
				(error && typeof error === 'object' && (error as any).location) ||
				(error && error.toString && error.toString().includes('Redirect'))
			) {
				throw error;
			}

			console.error('Registration error:', error);
			form.errors._errors = ['เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง'];
			return fail(503, { form });
		}
	}
};
