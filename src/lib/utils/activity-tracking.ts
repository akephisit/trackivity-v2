/**
 * Frontend utilities for activity tracking and analytics
 */

/**
 * Track activity view - call when user views an activity page
 */
export async function trackActivityView(activityId: string) {
	try {
		// This would call an API endpoint that logs the view
		await fetch(`/api/activities/${activityId}/view`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Failed to track activity view:', error);
		// Don't throw - tracking failures shouldn't break the app
	}
}

/**
 * Format participant count display
 */
export function formatParticipantCount(count: number, maxParticipants?: number): string {
	if (maxParticipants) {
		return `${count}/${maxParticipants}`;
	}
	return count.toString();
}

/**
 * Calculate participation rate
 */
export function calculateParticipationRate(count: number, maxParticipants?: number): number {
	if (!maxParticipants || maxParticipants === 0) return 0;
	return Math.round((count / maxParticipants) * 100);
}

/**
 * Get participation status variant for badges
 */
export function getParticipationVariant(count: number, maxParticipants?: number): 'default' | 'secondary' | 'destructive' | 'outline' {
	if (!maxParticipants) return 'outline';
	
	const rate = calculateParticipationRate(count, maxParticipants);
	
	if (rate >= 90) return 'default'; // High participation - green
	if (rate >= 70) return 'secondary'; // Medium participation - blue  
	if (rate >= 50) return 'outline'; // Low participation - gray
	return 'destructive'; // Very low participation - red
}

/**
 * Format view count for display
 */
export function formatViewCount(count: number): string {
	if (count >= 1000000) {
		return `${(count / 1000000).toFixed(1)}M`;
	}
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}K`;
	}
	return count.toString();
}