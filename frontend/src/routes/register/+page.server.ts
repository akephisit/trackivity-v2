import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { registerSchema } from '$lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';
import type { Organization } from '$lib/types/admin';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import { env } from '$env/dynamic/private';

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

	// TODO: Fetch organizations from backend API
	let organizationsList: Organization[] = [];

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
			const BACKEND_URL = env.BACKEND_URL || 'http://localhost:3000';
			// Register via Backend API
			const response = await fetch(`${BACKEND_URL}/auth/register`, {
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
					phone: null, // Form doesn't ask for phone yet?
					// department_id: form.data.department_id // Ignore for now as list is empty
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Registration failed: ${response.status} - ${errorText}`);

				// การสมัครล้มเหลว
				let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
				if (response.status === 409) {
					errorMessage = 'รหัสนักศึกษาหรืออีเมลนี้ถูกใช้งานแล้ว';
					if (errorText.includes('Student ID')) {
						form.errors.student_id = [errorMessage];
					} else {
						form.errors.email = [errorMessage];
					}
				} else {
					form.errors._errors = [errorMessage];
				}

				return fail(400, { form });
			}

			// Success
			throw redirect(303, '/login?registered=true');
		} catch (error) {
			// ตรวจสอบว่าเป็น redirect object หรือไม่
			if (
				(error && typeof error === 'object' && (error as any).status === 303) ||
				(error && typeof error === 'object' && (error as any).location)
			) {
				throw error;
			}

			console.error('Registration error:', error);
			form.errors._errors = ['เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง'];
			return fail(503, { form });
		}
	}
};
