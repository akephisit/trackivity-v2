import { db, sessions, users } from '$lib/server/db';
import { createSessionWithRetry, deactivateSession, debugSessionState } from './session-utils';

/**
 * Comprehensive session lifecycle test
 * This function creates a session and then immediately tries to deactivate it
 * to reproduce the issue you're experiencing
 */
export async function testSessionLifecycle(userId: string): Promise<void> {
	console.log('\n=== SESSION LIFECYCLE TEST ===');
	console.log(`Testing with user ID: ${userId}`);
	
	try {
		// Step 1: Create a session
		console.log('\n1. Creating session...');
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
		
		const sessionResult = await createSessionWithRetry(
			userId,
			expiresAt,
			{ test: true, browser: 'debug' },
			'127.0.0.1',
			'Debug-Agent/1.0'
		);
		
		console.log(`Created session: ${sessionResult.sessionId}, wasCreated: ${sessionResult.created}`);
		
		// Step 2: Immediately check if the session exists in the database
		console.log('\n2. Verifying session was created...');
		await debugSessionState(sessionResult.sessionId);
		
		// Step 3: Wait a brief moment to ensure database consistency
		console.log('\n3. Waiting 100ms for database consistency...');
		await new Promise(resolve => setTimeout(resolve, 100));
		
		// Step 4: Try to deactivate the session
		console.log('\n4. Attempting to deactivate session...');
		const deactivated = await deactivateSession(sessionResult.sessionId);
		console.log(`Deactivation result: ${deactivated}`);
		
		// Step 5: Final verification
		console.log('\n5. Final session state check...');
		await debugSessionState(sessionResult.sessionId);
		
		console.log('\n=== TEST COMPLETE ===\n');
		
	} catch (error) {
		console.error('Session lifecycle test failed:', error);
	}
}

/**
 * Test with a real user from the database
 */
export async function runSessionTestWithRealUser(): Promise<void> {
	try {
		// Get the first user from the database
		const userResult = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.limit(1);
			
		if (userResult.length === 0) {
			console.error('No users found in database. Cannot run session test.');
			return;
		}
		
		const user = userResult[0];
		console.log(`Using test user: ${user.email} (ID: ${user.id})`);
		
		await testSessionLifecycle(user.id);
		
	} catch (error) {
		console.error('Failed to run session test with real user:', error);
	}
}

/**
 * Direct database session count check
 */
export async function checkDatabaseSessionStats(): Promise<void> {
	try {
		console.log('\n=== DATABASE SESSION STATS ===');
		
		const allSessions = await db
			.select({
				id: sessions.id,
				userId: sessions.userId,
				isActive: sessions.isActive,
				createdAt: sessions.createdAt,
				expiresAt: sessions.expiresAt
			})
			.from(sessions);
			
		console.log(`Total sessions in database: ${allSessions.length}`);
		
		const activeSessions = allSessions.filter(s => s.isActive);
		const inactiveSessions = allSessions.filter(s => !s.isActive);
		const expiredSessions = allSessions.filter(s => new Date() > s.expiresAt);
		
		console.log(`Active sessions: ${activeSessions.length}`);
		console.log(`Inactive sessions: ${inactiveSessions.length}`);
		console.log(`Expired sessions: ${expiredSessions.length}`);
		
		console.log('\nRecent sessions:');
		allSessions
			.sort((a, b) => {
				const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bTime - aTime;
			})
			.slice(0, 5)
			.forEach((s, index) => {
				console.log(`  ${index + 1}. ID: ${s.id} | Active: ${s.isActive} | Created: ${s.createdAt} | User: ${s.userId}`);
			});
			
		console.log('=== END STATS ===\n');
		
	} catch (error) {
		console.error('Failed to check database session stats:', error);
	}
}