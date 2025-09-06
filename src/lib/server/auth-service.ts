import { db, users, adminRoles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { SessionUser, Permission } from '$lib/types';
import { env } from '$env/dynamic/private';
import { createSessionWithRetry, cleanupExpiredSessions } from './session-utils';

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

export async function authenticateAndIssueToken(input: AuthInput): Promise<AuthResult> {
	const { email, student_id, password, remember_me } = input;

	if (!password || (!email && !student_id)) {
		const err: any = new Error('Email or Student ID and password are required');
		err.code = 'VALIDATION_ERROR';
		throw err;
	}

	const userRes = await db
		.select()
		.from(users)
		.where(email ? eq(users.email, email) : eq(users.studentId, student_id!))
		.limit(1);

	if (userRes.length === 0) {
		const err: any = new Error('Invalid credentials');
		err.code = 'AUTH_ERROR';
		throw err;
	}

	const foundUser = userRes[0];

	// Enforce password-based login only (no passwordless)
	// Guard against disabled/blank hashes (treat as password login disabled)
	if (
		!foundUser.passwordHash ||
		foundUser.passwordHash.trim() === '' ||
		foundUser.passwordHash === 'DISABLED'
	) {
		const err: any = new Error('Password login disabled for this account');
		err.code = 'PASSWORD_DISABLED';
		throw err;
	}

	const isValidPassword = await argon2.verify(foundUser.passwordHash, password);
	if (!isValidPassword) {
		const err: any = new Error('Invalid credentials');
		err.code = 'AUTH_ERROR';
		throw err;
	}

	const adminRoleRes = await db
		.select()
		.from(adminRoles)
		.where(eq(adminRoles.userId, foundUser.id))
		.limit(1);

	const permissions: Permission[] = [];
	const isAdmin = adminRoleRes.length > 0;
	const adminLevel = isAdmin ? adminRoleRes[0].adminLevel : null;

	const convertAdminLevel = (dbLevel: string | null): string | null => {
		if (!dbLevel) return null;
		switch (dbLevel) {
			case 'super_admin':
				return 'SuperAdmin';
			case 'organization_admin':
				return 'OrganizationAdmin';
			case 'regular_admin':
				return 'RegularAdmin';
			default:
				return 'RegularAdmin';
		}
	};

	const convertedAdminLevel = convertAdminLevel(adminLevel);

	if (isAdmin) {
		if (adminLevel === 'super_admin') {
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
		} else if (adminLevel === 'organization_admin') {
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

	// Expiration: 30 days if remember_me, otherwise default 7 days
	const expiresInSeconds = (remember_me ? 30 : 7) * 24 * 60 * 60;
	const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

	// First, create a preliminary JWT payload without session ID to generate token for fallback
	const preliminaryPayload = {
		user_id: foundUser.id,
		student_id: foundUser.studentId,
		email: foundUser.email,
		first_name: foundUser.firstName,
		last_name: foundUser.lastName,
		department_id: foundUser.departmentId,
		is_admin: isAdmin,
		admin_level: convertedAdminLevel,
		organization_id: isAdmin ? (adminRoleRes[0] as any).organizationId : null
	};

	// Generate preliminary token for fallback session ID
	const preliminaryToken = jwt.sign(preliminaryPayload, env.JWT_SECRET!, { expiresIn: expiresInSeconds });
	
	// Create session record for tracking last access with robust collision handling
	let sessionId: string;
	let token: string;
	
	try {
		// Run cleanup asynchronously to prevent old sessions from accumulating
		cleanupExpiredSessions().catch(err => 
			console.warn('Background session cleanup failed:', err)
		);
		
		// Create session with collision handling and retry logic
		const sessionResult = await createSessionWithRetry(
			foundUser.id,
			expiresAt,
			{}, // deviceInfo - could be populated from request headers
			null, // ipAddress - could be populated from request
			null  // userAgent - could be populated from request
		);
		
		sessionId = sessionResult.sessionId;
		
		if (!sessionResult.created) {
			console.log(`[Auth] Reused existing session ${sessionId} for user ${foundUser.id}`);
		}
		
		// Create final JWT payload with the actual session ID
		const finalPayload = {
			...preliminaryPayload,
			session_id: sessionId
		};
		
		// Generate final token with session ID included
		token = jwt.sign(finalPayload, env.JWT_SECRET!, { expiresIn: expiresInSeconds });
		
	} catch (error) {
		// Don't fail login if session creation fails, but log the error
		console.error('Failed to create session record:', error);
		
		// Fall back to using a portion of the token as session ID for compatibility
		sessionId = preliminaryToken.slice(0, 16);
		console.warn(`[Auth] Using fallback session ID ${sessionId} for user ${foundUser.id}`);
		
		// Use preliminary token as the final token
		token = preliminaryToken;
	}

	const sessionUser: SessionUser = {
		user_id: foundUser.id,
		student_id: foundUser.studentId,
		email: foundUser.email,
		first_name: foundUser.firstName,
		last_name: foundUser.lastName,
		department_id: foundUser.departmentId || undefined,
		organization_id: (isAdmin ? (adminRoleRes[0] as any).organizationId : null) || undefined,
		session_id: sessionId,
		permissions,
		expires_at: expiresAt.toISOString(),
		created_at: foundUser.createdAt?.toISOString(),
		updated_at: foundUser.updatedAt?.toISOString(),
		admin_role: isAdmin
			? {
					id: adminRoleRes[0].id,
					admin_level: convertedAdminLevel as any,
					organization_id: (adminRoleRes[0] as any).organizationId || undefined,
					permissions,
					created_at: adminRoleRes[0].createdAt?.toISOString() || new Date().toISOString(),
					updated_at: adminRoleRes[0].updatedAt?.toISOString() || new Date().toISOString()
				}
			: undefined
	};

	return { user: sessionUser, token, expiresAt };
}
