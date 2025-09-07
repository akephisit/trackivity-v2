import { db, sessions } from '$lib/server/db';
import { eq, and, or, lt, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';

/**
 * Session utility functions for robust session management
 * Addresses the duplicate key constraint violation issue
 */

/**
 * Generate a cryptographically secure session ID
 * Uses randomBytes for true randomness instead of predictable JWT token slicing
 */
export function generateSecureSessionId(): string {
	// Generate 32 random bytes and encode as base64url (URL-safe)
	const randomId = randomBytes(32)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	// Add timestamp prefix to ensure uniqueness even with identical random values
	const timestamp = Date.now().toString(36); // Base36 timestamp
	const nanoTime = process.hrtime.bigint().toString(36); // High-resolution time

	return `${timestamp}-${nanoTime.slice(-8)}-${randomId.slice(0, 24)}`;
}

/**
 * Clean up expired sessions from the database
 * Helps prevent table bloat and removes orphaned sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
	try {
		const result = await db.delete(sessions).where(
			or(
				lt(sessions.expiresAt, new Date()), // Expired sessions
				eq(sessions.isActive, false) // Inactive sessions
			)
		);

		const deletedCount = result.length || 0;
		if (deletedCount > 0) {
			console.log(`[Session Cleanup] Removed ${deletedCount} expired/inactive sessions`);
		}

		return deletedCount;
	} catch (error) {
		console.error('[Session Cleanup] Failed to clean up expired sessions:', error);
		return 0;
	}
}

/**
 * Clean up old sessions for a specific user (keep only the most recent N sessions)
 * Prevents session accumulation for users who log in frequently
 */
export async function cleanupUserSessions(userId: string, keepLatest: number = 5): Promise<number> {
	try {
		// Get all sessions for the user, ordered by creation date (newest first)
		const userSessions = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.userId, userId))
			.orderBy(sessions.created_at);

		if (userSessions.length <= keepLatest) {
			return 0; // No cleanup needed
		}

		// Delete all but the most recent sessions
		const sessionsToDelete = userSessions.slice(keepLatest);
		const sessionIds = sessionsToDelete.map((s) => s.id);

		if (sessionIds.length > 0) {
			const result = await db.delete(sessions).where(
				and(
					eq(sessions.userId, userId),
					// Only delete the specific old sessions
					or(...sessionIds.map((id) => eq(sessions.id, id)))
				)
			);

			const deletedCount = result.length || 0;
			console.log(`[Session Cleanup] Removed ${deletedCount} old sessions for user ${userId}`);
			return deletedCount;
		}

		return 0;
	} catch (error) {
		console.error('[Session Cleanup] Failed to clean up user sessions:', error);
		return 0;
	}
}

/**
 * Create session with upsert logic and collision handling
 * Handles duplicate key errors gracefully with retry mechanism
 */
export async function createSessionWithRetry(
	userId: string,
	expiresAt: Date,
	deviceInfo: any = {},
	ipAddress: string | null = null,
	userAgent: string | null = null,
	maxRetries: number = 3
): Promise<{ sessionId: string; created: boolean }> {
	let lastError: Error | null = null;

	// Clean up user's old sessions before creating a new one
	await cleanupUserSessions(userId, 3);

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const sessionId = generateSecureSessionId();

			// Attempt to insert the session
			await db.insert(sessions).values({
				id: sessionId,
				userId,
				deviceFingerprint: deviceInfo ? JSON.stringify(deviceInfo).slice(0, 64) : null,
				ipAddress,
				userAgent,
				created_at: new Date(),
				lastAccessed: new Date(),
				expiresAt,
				isActive: true
			});

			return { sessionId, created: true };
		} catch (error: any) {
			lastError = error;

			// Check if it's a duplicate key error
			if (error?.code === '23505' && error?.constraint === 'sessions_pkey') {
				console.warn(
					`[Session] Duplicate session ID on attempt ${attempt}/${maxRetries}, retrying...`
				);

				if (attempt === maxRetries) {
					// On final attempt, try to find existing session or clean up
					console.error('[Session] Max retries reached, attempting session recovery');

					try {
						// Try to find and reuse an existing session for this user
						const existingSessions = await db
							.select()
							.from(sessions)
							.where(
								and(
									eq(sessions.userId, userId),
									eq(sessions.isActive, true),
									// Session should not be expired
									gt(sessions.expiresAt, new Date())
								)
							)
							.orderBy(sessions.created_at)
							.limit(1);

						if (existingSessions.length > 0) {
							const existingSession = existingSessions[0];
							return { sessionId: existingSession.id, created: false };
						}
					} catch (recoveryError) {
						console.error('[Session] Session recovery failed:', recoveryError);
					}
				}

				// Wait briefly before retry to avoid rapid collision
				await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
				continue;
			}

			// Non-duplicate key error, don't retry
			console.error(`[Session] Non-recoverable session creation error:`, error);
			throw error;
		}
	}

	// All retries failed
	throw new Error(`Failed to create session after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Update session last accessed timestamp
 * Non-blocking operation for better performance
 */
export async function updateSessionLastAccessed(sessionId: string): Promise<void> {
	try {
		await db
			.update(sessions)
			.set({
				lastAccessed: new Date(),
				isActive: true // Ensure session is marked active
			})
			.where(eq(sessions.id, sessionId));
	} catch (error) {
		// Don't throw errors for session updates, just log them
		console.warn(`[Session] Failed to update last accessed for session ${sessionId}:`, error);
	}
}

/**
 * Deactivate a specific session
 */
export async function deactivateSession(sessionId: string): Promise<boolean> {
	try {
		// First, check if session exists and get its current state
		const existingSession = await db
			.select({ id: sessions.id, isActive: sessions.isActive })
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1);

		if (existingSession.length === 0) {
			console.log(`[Auth] Session ${sessionId} was already inactive or not found`);
			return false;
		}

		const session = existingSession[0];

		if (!session.isActive) {
			console.log(`[Auth] Session ${sessionId} was already inactive or not found`);
			return false;
		}

		// Update the session to inactive
		const result = await db
			.update(sessions)
			.set({ isActive: false })
			.where(eq(sessions.id, sessionId))
			.returning({ id: sessions.id });

		const success = result.length > 0;

		return success;
	} catch (error) {
		console.error(`[Session] Failed to deactivate session ${sessionId}:`, error);
		return false;
	}
}

/**
 * Get session information
 */
export async function getSession(sessionId: string) {
	try {
		const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error(`[Session] Failed to get session ${sessionId}:`, error);
		return null;
	}
}
