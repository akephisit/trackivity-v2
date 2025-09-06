import { json, type RequestHandler } from '@sveltejs/kit';
import { deactivateSession } from '$lib/server/session-utils';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

/**
 * User logout endpoint
 * Clears JWT session token from httpOnly cookie
 */
export const POST: RequestHandler = async ({ cookies }) => {
	try {
		// Get session token before deleting it
		const sessionToken = cookies.get('session_token');
		
		// Mark session as inactive in database
		if (sessionToken) {
			try {
				// Extract session ID from JWT token payload
				const decoded = jwt.verify(sessionToken, env.JWT_SECRET!) as any;
				const sessionId = decoded.session_id;
				
				if (sessionId) {
					await deactivateSession(sessionId);
				}
			} catch (error) {
				console.warn('Failed to decode JWT token during logout:', error);
				// Don't fail logout if JWT decode fails
			}
		}

		// Clear the JWT session token cookie
		cookies.delete('session_token', {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		return json({
			success: true,
			data: {
				message: 'Successfully logged out',
				timestamp: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error('[Auth] Logout error:', error);

		// Even if there's an error, we should still clear the cookie
		cookies.delete('session_token', {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		// Return success anyway since logout is idempotent
		return json({
			success: true,
			data: {
				message: 'Logged out (with cleanup)',
				timestamp: new Date().toISOString()
			}
		});
	}
};
