/**
 * Session cleanup scheduler
 * Runs periodic cleanup tasks to maintain database health
 */

import { cleanupExpiredSessions } from './session-utils';

// Track cleanup interval to prevent multiple instances
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start automatic session cleanup
 * Runs cleanup every 30 minutes by default
 */
export function startSessionCleanup(intervalMinutes: number = 30): void {
	if (cleanupInterval) {
		console.log('[Session Cleanup] Cleanup scheduler already running');
		return;
	}

	const intervalMs = intervalMinutes * 60 * 1000;

	// Run initial cleanup
	cleanupExpiredSessions()
		.then((count) => {
			if (count > 0) {
				console.log(`[Session Cleanup] Initial cleanup removed ${count} expired sessions`);
			}
		})
		.catch((err) => console.error('[Session Cleanup] Initial cleanup failed:', err));

	// Schedule periodic cleanup
	cleanupInterval = setInterval(async () => {
		try {
			const count = await cleanupExpiredSessions();
			if (count > 0) {
				console.log(`[Session Cleanup] Periodic cleanup removed ${count} expired sessions`);
			}
		} catch (error) {
			console.error('[Session Cleanup] Periodic cleanup failed:', error);
		}
	}, intervalMs);

	console.log(
		`[Session Cleanup] Started session cleanup scheduler (every ${intervalMinutes} minutes)`
	);
}

/**
 * Stop automatic session cleanup
 */
export function stopSessionCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
		console.log('[Session Cleanup] Stopped session cleanup scheduler');
	}
}

/**
 * Get cleanup scheduler status
 */
export function isCleanupRunning(): boolean {
	return cleanupInterval !== null;
}

// Auto-start cleanup in production (skip on Vercel serverless)
if (
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  process.env.VERCEL !== '1'
) {
  // Start cleanup on module load in long-lived environments
  startSessionCleanup(30); // Every 30 minutes
}
