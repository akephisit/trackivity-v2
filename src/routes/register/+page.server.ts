import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { registerSchema } from '$lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';
import type { Faculty } from '$lib/types/admin';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import { db, faculties } from '$lib/server/db';
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

	// โหลดรายการคณะจากฐานข้อมูลโดยตรง
	let facultiesList: Faculty[] = [];

	try {
		const result = await db
			.select({
				id: faculties.id,
				name: faculties.name,
				code: faculties.code,
				description: faculties.description,
				status: faculties.status,
				created_at: faculties.createdAt,
				updated_at: faculties.updatedAt
			})
			.from(faculties)
			.where(eq(faculties.status, true))
			.orderBy(faculties.name);

		facultiesList = result;
	} catch (error) {
		console.error('Failed to load faculties from database:', error);
		throw new Error('ไม่สามารถโหลดข้อมูลคณะได้ กรุณาลองใหม่อีกครั้ง');
	}

	const form = await superValidate(zod(registerSchema));
	
	return {
		form,
		faculties: facultiesList
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
			if (error instanceof Response || 
				(error && typeof error === 'object' && (error as any).status === 303) ||
				(error && typeof error === 'object' && (error as any).location) ||
				(error && error.toString && error.toString().includes('Redirect'))) {
				throw error;
			}
			
			console.error('Registration error:', error);
			form.errors._errors = ['เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง'];
			return fail(503, { form });
		}
	}
};
