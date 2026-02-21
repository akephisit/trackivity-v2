import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { SessionUser, Permission } from '$lib/types';

export interface AuthInput {
	email?: string;
	student_id?: string;
	password: string;
	remember_me?: boolean;
}

export interface AuthResult {
	user: SessionUser;
	token: string;
	expiresAt: Date;
}

const BACKEND_URL = publicEnv.PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function authenticateAndIssueToken(input: AuthInput): Promise<AuthResult> {
	try {
		console.log(`[Auth] Attempting login via backend: ${BACKEND_URL}`);
		const response = await fetch(`${BACKEND_URL}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = 'Login failed';
			let errorCode = 'AUTH_ERROR';

			// Map status codes to existing error codes expected by +page.server.ts
			if (response.status === 401) {
				errorMessage = 'Invalid credentials';
			} else if (response.status === 403) {
				errorMessage = 'Account disabled';
				errorCode = 'PASSWORD_DISABLED';
			} else if (response.status === 400) {
				errorMessage = 'Invalid input';
				errorCode = 'VALIDATION_ERROR';
			}

			console.error(`[Auth] Backend error: ${response.status} - ${errorText}`);
			const err: any = new Error(errorMessage);
			err.code = errorCode;
			throw err;
		}

		const data = await response.json();
		const user = data.user;
		const token = data.token;

		// Map backend user to SessionUser
		const sessionUser: SessionUser = {
			user_id: user.user_id,
			student_id: user.student_id,
			email: user.email,
			first_name: user.first_name,
			last_name: user.last_name,
			prefix: user.prefix,
			admin_role: user.admin_role,
			session_id: user.session_id,
			permissions: (user.admin_role?.permissions || []) as Permission[],
			expires_at: user.expires_at,
			// Optional fields
			created_at: undefined,
			updated_at: undefined,
			department_id: undefined, // Backend should return these if needed
			organization_id: user.admin_role?.organization_id, // Extract from role
		};

		return {
			user: sessionUser,
			token,
			expiresAt: new Date(user.expires_at)
		};
	} catch (error) {
		console.error('[Auth] Login service error:', error);
		throw error;
	}
}
