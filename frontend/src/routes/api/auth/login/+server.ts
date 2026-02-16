import { json, type RequestHandler } from '@sveltejs/kit';
import type { LoginRequest } from '$lib/types';
import { authenticateAndIssueToken } from '$lib/server/auth-service';

/**
 * User authentication endpoint
 * Validates credentials and creates JWT session
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body: LoginRequest & { student_id?: string; device_info?: any; remember_me?: boolean } =
			await request.json();
		const { email, password, student_id, remember_me } = body;

		const { user, token, expiresAt } = await authenticateAndIssueToken({
			email,
			student_id,
			password,
			remember_me
		});

		// Set secure HTTP-only cookie
		cookies.set('session_token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			...(remember_me ? { maxAge: 30 * 24 * 60 * 60 } : {}),
			path: '/'
		});

		return json({
			success: true,
			data: {
				user
			}
		});
	} catch (error) {
		console.error('[Auth] Login error:', error);
		return json(
			{
				success: false,
				error: {
					code: (error as any)?.code || 'INTERNAL_ERROR',
					message: (error as any)?.message || 'An unexpected error occurred during login',
					details:
						process.env.NODE_ENV === 'development'
							? { error: error instanceof Error ? error.message : 'Unknown error' }
							: undefined
				}
			},
			{ status: 500 }
		);
	}
};
