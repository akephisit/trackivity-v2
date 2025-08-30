import { json, type RequestHandler } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import type { SessionUser, Permission } from '$lib/types';
import { env } from '$env/dynamic/private';
import { db, users, departments, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';

/**
 * JWT payload interface matching login endpoint
 */
interface JWTPayload {
	user_id: string;
	student_id: string;
	email: string;
	first_name: string;
	last_name: string;
	department_id?: string;
	is_admin: boolean;
	admin_level?: string;
	organization_id?: string;
	iat?: number;
	exp?: number;
}

/**
 * Get current user session information
 * Validates JWT token and returns user data in consistent format
 */
export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('session_token');

		if (!token) {
			// Return 200 to avoid noisy console error on first load
			return json({
				success: false,
				error: {
					code: 'NO_SESSION',
					message: 'No active session found'
				}
			});
		}

		// Verify and decode JWT
		try {
			const secret = env.JWT_SECRET;
			if (!secret) {
				return json({
					success: false,
					error: { code: 'SERVER_MISCONFIG', message: 'Server misconfiguration' }
				});
			}
			const decoded = jwt.verify(token, secret) as JWTPayload;

			// Check token expiration
			if (decoded.exp && Date.now() >= decoded.exp * 1000) {
				// Return 200 to avoid console error; client handles gracefully
				return json({
					success: false,
					error: {
						code: 'SESSION_EXPIRED',
						message: 'Session has expired'
					}
				});
			}


			// Build permissions array based on admin status
			const permissions: Permission[] = [];
			if (decoded.is_admin) {
				if (decoded.admin_level === 'SuperAdmin') {
					permissions.push(
						'ViewAllUsers',
						'CreateUsers',
						'UpdateUsers',
						'DeleteUsers',
						'ViewAllOrganizations',
						'CreateOrganizations',
						'UpdateOrganizations',
						'DeleteOrganizations',
						'ViewAllSessions',
						'ManageAllSessions',
						'ViewSystemAnalytics'
					);
				} else if (decoded.admin_level === 'OrganizationAdmin') {
					permissions.push(
						'ViewOrganizationUsers',
						'CreateOrganizationUsers',
						'UpdateOrganizationUsers',
						'ViewOrganizationAnalytics',
						'ManageOrganizationActivities',
						'ViewOrganizationSessions',
						'ManageOrganizationSessions'
					);
				} else {
					permissions.push('ViewAssignedActivities', 'ScanQRCodes', 'ViewPersonalSessions');
				}
			} else {
				permissions.push('ViewPersonalQR', 'ViewPersonalHistory');
			}

			// Enrich with live DB info to ensure fresh profile fields
			const rows = await db
				.select({
					user: users,
					dept: departments,
					org: organizations
				})
				.from(users)
				.leftJoin(departments, eq(users.departmentId, departments.id))
				.leftJoin(organizations, eq(departments.organizationId, organizations.id))
				.where(eq(users.id, decoded.user_id))
				.limit(1);

			const row = rows[0];
			const u = row?.user;

			const sessionUser: SessionUser = {
				user_id: decoded.user_id,
				student_id: decoded.student_id,
				email: decoded.email,
				first_name: decoded.first_name,
				last_name: decoded.last_name,
				department_id: decoded.department_id || u?.departmentId || undefined,
				organization_id: decoded.organization_id || row?.org?.id || undefined,
				organization_name: row?.org?.name || undefined,
				department_name: row?.dept?.name || undefined,
				session_id: token.slice(0, 16),
				permissions,
				expires_at: decoded.exp
					? new Date(decoded.exp * 1000).toISOString()
					: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: u?.createdAt ? new Date(u.createdAt).toISOString() : undefined,
				updated_at: u?.updatedAt ? new Date(u.updatedAt).toISOString() : undefined,
				admin_role: decoded.is_admin
					? {
							id: `admin_${decoded.user_id}`,
							admin_level: (decoded.admin_level as any) || 'RegularAdmin',
							organization_id: decoded.organization_id || row?.org?.id || undefined,
							permissions,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}
					: undefined
			};

			return json({ success: true, data: sessionUser });
		} catch (jwtError) {
			console.debug('[Auth] JWT validation failed:', jwtError);
			// Return 200 with error payload; client handles silently
			return json({
				success: false,
				error: {
					code: 'SESSION_INVALID',
					message: 'Invalid or corrupted session'
				}
			});
		}
	} catch (error) {
		console.error('[Auth] Me endpoint error:', error);
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'Internal server error'
				}
			},
			{ status: 500 }
		);
	}
};
