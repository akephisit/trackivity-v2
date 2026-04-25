/**
 * Frontend utilities for activity display formatting.
 */

/**
 * Format participant count display, optionally with a max cap (e.g. "12/30").
 */
export function formatParticipantCount(count: number, maxParticipants?: number): string {
	if (maxParticipants) {
		return `${count}/${maxParticipants}`;
	}
	return count.toString();
}

/**
 * Format view count for display (e.g. 1.2K, 3.4M).
 */
export function formatViewCount(count: number): string {
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(1)}M`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(1)}K`;
	}
	return count.toString();
}
