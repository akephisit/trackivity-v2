import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Log activity view using the optimized database function
 * This utilizes the log_activity_view function from partitioning.sql
 */
export async function logActivityView(
	activityId: string,
	userId?: string,
	ipAddress?: string,
	sessionId?: string
): Promise<void> {
	try {
		await db.execute(
			sql`SELECT log_activity_view(
				${activityId}::uuid,
				${userId ? `${userId}::uuid` : 'NULL'},
				${ipAddress ? `'${ipAddress}'::inet` : 'NULL'},
				${sessionId || 'NULL'}
			)`
		);
	} catch (error) {
		console.error('Failed to log activity view:', error);
		// Don't throw error - this is just tracking, shouldn't break app functionality
	}
}

/**
 * Search users using the optimized database search function
 */
export async function searchUsersOptimized(searchTerm: string) {
	try {
		const result = await db.execute(
			sql`SELECT * FROM search_users(${searchTerm})`
		);
		return result;
	} catch (error) {
		console.error('Failed to search users:', error);
		return [];
	}
}

/**
 * Search activities using the optimized database search function
 */
export async function searchActivitiesOptimized(
	searchTerm: string,
	orgId?: string,
	academicYear?: number,
	activityStatus: string = 'published'
) {
	try {
		const result = await db.execute(
			sql`SELECT * FROM search_activities(
				${searchTerm},
				${orgId ? `${orgId}::uuid` : 'NULL'},
				${academicYear || 'NULL'},
				${activityStatus}
			)`
		);
		return result;
	} catch (error) {
		console.error('Failed to search activities:', error);
		return [];
	}
}