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

	// Fetch organizations from Backend API
	let organizationsList: Organization[] = [];
	try {
		const BACKEND_URL = env.BACKEND_URL || 'http://localhost:3000';
		const response = await fetch(`${BACKEND_URL}/organizations`);
		if (response.ok) {
			const data = await response.json();
			// Data structure: { all: [], grouped: { faculty: [], office: [] } }
			// For student registration, we usually want faculties
			if (data.grouped && data.grouped.faculty) {
				organizationsList = data.grouped.faculty;
			} else if (data.all) {
				// Fallback to filtering if backend didn't group correctly
				organizationsList = data.all.filter((o: any) => o.organization_type === 'faculty');
			}
		} else {
			console.error('Failed to fetch organizations:', response.status);
		}
	} catch (e) {
		console.error('Error fetching organizations:', e);
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
					phone: null,
					department_id: form.data.department_id // Now valid if picked from real list (backend ignores currently but good to send)
				})
			});

			if (!response.ok) {
				const errorText = await response.text();

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
