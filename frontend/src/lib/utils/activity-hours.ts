/**
 * Utility functions for calculating cumulative activity hours
 * Updated to calculate total accumulated hours across all academic years
 */


export interface ParticipationWithActivity {
	id: string;
	activity_id: string;
	user_id: string;
	status: 'registered' | 'checked_in' | 'checked_out' | 'completed' | 'no_show';
	participated_at?: string;
	checked_in_at?: string | null;
	checked_out_at?: string | null;
	activity: {
		id: string;
		title: string;
		hours: number;
		activity_level: 'faculty' | 'university';
		status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
	};
}

export interface HoursSummary {
	totalHours: number;
	facultyHours: number;
	universityHours: number;
	completedActivities: number;
	totalActivities: number;
}

export interface RequirementProgress {
	facultyHours: {
		current: number;
		required: number;
		percentage: number;
		isComplete: boolean;
	};
	universityHours: {
		current: number;
		required: number;
		percentage: number;
		isComplete: boolean;
	};
	overall: {
		currentTotal: number;
		requiredTotal: number;
		percentage: number;
		isComplete: boolean;
	};
}

/**
 * Calculate cumulative activity hours from participation history
 * Only counts activities where the student has completed participation (checked out or completed status)
 */
export function calculateCumulativeHours(
	participations: ParticipationWithActivity[]
): HoursSummary {
	let facultyHours = 0;
	let universityHours = 0;
	let completedActivities = 0;

	const countedActivities = new Set<string>();

	participations.forEach((participation) => {
		const { activity, status } = participation;

		// Only count completed activities (checked_out or completed status)
		// and avoid double-counting the same activity
		if (
			(status === 'checked_out' || status === 'completed') &&
			activity.status === 'completed' &&
			!countedActivities.has(activity.id)
		) {
			countedActivities.add(activity.id);

			if (activity.activity_level === 'faculty') {
				facultyHours += activity.hours;
			} else if (activity.activity_level === 'university') {
				universityHours += activity.hours;
			}

			completedActivities++;
		}
	});

	return {
		totalHours: facultyHours + universityHours,
		facultyHours,
		universityHours,
		completedActivities,
		totalActivities: participations.length
	};
}

/**
 * Calculate progress towards activity hour requirements
 */
export function calculateRequirementProgress(
	currentHours: HoursSummary,
	requirements: { requiredFacultyHours: number; requiredUniversityHours: number } | null
): RequirementProgress {
	if (!requirements) {
		return {
			facultyHours: {
				current: currentHours.facultyHours,
				required: 0,
				percentage: 100,
				isComplete: true
			},
			universityHours: {
				current: currentHours.universityHours,
				required: 0,
				percentage: 100,
				isComplete: true
			},
			overall: {
				currentTotal: currentHours.totalHours,
				requiredTotal: 0,
				percentage: 100,
				isComplete: true
			}
		};
	}

	const facultyPercentage =
		requirements.requiredFacultyHours > 0
			? Math.min((currentHours.facultyHours / requirements.requiredFacultyHours) * 100, 100)
			: 100;

	const universityPercentage =
		requirements.requiredUniversityHours > 0
			? Math.min((currentHours.universityHours / requirements.requiredUniversityHours) * 100, 100)
			: 100;

	const requiredTotal = requirements.requiredFacultyHours + requirements.requiredUniversityHours;
	const overallPercentage =
		requiredTotal > 0 ? Math.min((currentHours.totalHours / requiredTotal) * 100, 100) : 100;

	return {
		facultyHours: {
			current: currentHours.facultyHours,
			required: requirements.requiredFacultyHours,
			percentage: facultyPercentage,
			isComplete: currentHours.facultyHours >= requirements.requiredFacultyHours
		},
		universityHours: {
			current: currentHours.universityHours,
			required: requirements.requiredUniversityHours,
			percentage: universityPercentage,
			isComplete: currentHours.universityHours >= requirements.requiredUniversityHours
		},
		overall: {
			currentTotal: currentHours.totalHours,
			requiredTotal,
			percentage: overallPercentage,
			isComplete:
				currentHours.totalHours >= requiredTotal &&
				currentHours.facultyHours >= requirements.requiredFacultyHours &&
				currentHours.universityHours >= requirements.requiredUniversityHours
		}
	};
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
	return `${hours.toLocaleString()} ชั่วโมง`;
}

/**
 * Get progress status text
 */
export function getProgressStatusText(progress: RequirementProgress): {
	status: 'complete' | 'in_progress' | 'not_started';
	text: string;
	color: string;
} {
	if (progress.overall.isComplete) {
		return {
			status: 'complete',
			text: 'ผ่านเกณฑ์แล้ว',
			color: 'text-green-600'
		};
	}

	if (progress.overall.currentTotal > 0) {
		return {
			status: 'in_progress',
			text: `กำลังดำเนินการ (${progress.overall.percentage.toFixed(1)}%)`,
			color: 'text-blue-600'
		};
	}

	return {
		status: 'not_started',
		text: 'ยังไม่ได้เริ่ม',
		color: 'text-gray-500'
	};
}

/**
 * Calculate remaining hours needed
 */
export function calculateRemainingHours(progress: RequirementProgress): {
	facultyRemaining: number;
	universityRemaining: number;
	totalRemaining: number;
} {
	return {
		facultyRemaining: Math.max(0, progress.facultyHours.required - progress.facultyHours.current),
		universityRemaining: Math.max(
			0,
			progress.universityHours.required - progress.universityHours.current
		),
		totalRemaining: Math.max(0, progress.overall.requiredTotal - progress.overall.currentTotal)
	};
}
