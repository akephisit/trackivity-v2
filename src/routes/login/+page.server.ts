import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import type { Actions, PageServerLoad } from './$types';

/**
 * Login page loader
 * Redirects to dashboard if user is already authenticated
 */
export const load: PageServerLoad = async (event) => {
	const { url } = event;

	// Check if user is already authenticated via JWT middleware
	const user = getOptionalAuthUser(event);
	if (user) {
		// User is already logged in, redirect to appropriate dashboard
		const redirectTo =
			url.searchParams.get('redirectTo') || (user.admin_role ? '/admin' : '/student');
		throw redirect(303, redirectTo);
	}

	// Initialize login form
	const form = await superValidate(zod(loginSchema));
	return {
		form,
		redirectTo: url.searchParams.get('redirectTo') || null
	};
};

/**
 * Login form actions
 * Handles user authentication via JWT API
 */
export const actions: Actions = {
	default: async (event) => {
		const { request, url, cookies } = event;
		const form = await superValidate(request, zod(loginSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Authenticate directly via server-side service, then set cookie
			const { authenticateAndIssueToken } = await import('$lib/server/auth-service');
			const { user, token } = await authenticateAndIssueToken({
				email: form.data.student_id.includes('@') ? form.data.student_id : undefined,
				student_id: !form.data.student_id.includes('@') ? form.data.student_id : undefined,
				password: form.data.password,
				remember_me: form.data.remember_me
			});

			if (!user) {
				form.errors.student_id = ['Invalid credentials'];
				return fail(400, { form });
			}

			cookies.set('session_token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				...(form.data.remember_me ? { maxAge: 30 * 24 * 60 * 60 } : {}),
				path: '/'
			});

			const redirectTo =
				url.searchParams.get('redirectTo') || (user.admin_role ? '/admin' : '/student');
			throw redirect(303, redirectTo);
		} catch (error: any) {
			// Handle redirect errors (normal flow)
			if (
				error &&
				typeof error === 'object' &&
				'status' in (error as any) &&
				'location' in (error as any)
			) {
				throw error;
			}

			// Handle other errors
			const code =
				error && typeof error === 'object' && 'code' in error ? (error as any).code : undefined;
			let message = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่';
			let status = 500;

			if (code === 'PASSWORD_DISABLED') {
				message = 'บัญชีนี้ปิดการเข้าสู่ระบบด้วยรหัสผ่าน กรุณาติดต่อผู้ดูแลหรือใช้วิธีอื่น';
				status = 403;
			} else if (code === 'AUTH_ERROR') {
				message = 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง';
				status = 401;
			} else if (code === 'VALIDATION_ERROR') {
				message = 'ข้อมูลไม่ครบถ้วน กรุณากรอกรหัสนักศึกษาและรหัสผ่าน';
				status = 400;
			}

			console.error('[Auth] Login form error:', { code, message });
			return fail(status, { form, message });
		}
	}
};
