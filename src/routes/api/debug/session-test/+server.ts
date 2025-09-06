import { json, type RequestHandler } from '@sveltejs/kit';
import { runSessionTestWithRealUser, checkDatabaseSessionStats } from '$lib/server/session-debug';

/**
 * Debug endpoint to test session lifecycle
 * GET /api/debug/session-test
 */
export const GET: RequestHandler = async () => {
	try {
		console.log('\n🔍 STARTING SESSION DEBUG TEST 🔍');
		
		// First, check current database state
		await checkDatabaseSessionStats();
		
		// Run the session lifecycle test
		await runSessionTestWithRealUser();
		
		// Check database state again
		await checkDatabaseSessionStats();
		
		return json({
			success: true,
			message: 'Session test completed. Check server logs for detailed output.',
			timestamp: new Date().toISOString()
		});
		
	} catch (error) {
		console.error('Session test endpoint error:', error);
		
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
};