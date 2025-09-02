/**
 * Activity Summary Utilities
 * Shared logic for calculating activity statistics and summaries
 */

export interface ActivityRequirements {
  requiredFacultyHours: number;
  requiredUniversityHours: number;
}

export interface ProgressInfo {
  facultyProgress: {
    current: number;
    required: number;
    percentage: number;
    remaining: number;
    isPassing: boolean;
  };
  universityProgress: {
    current: number;
    required: number;
    percentage: number;
    remaining: number;
    isPassing: boolean;
  };
  overallProgress: {
    current: number;
    required: number;
    percentage: number;
    remaining: number;
    isPassing: boolean;
  };
}

export interface ActivitySummaryStats {
  totalActivities: number;
  completedActivities: number;
  totalHours: number;
  facultyLevel: {
    activities: number;
    hours: number;
    byType: Record<string, { count: number; hours: number }>;
  };
  universityLevel: {
    activities: number;
    hours: number;
    byType: Record<string, { count: number; hours: number }>;
  };
  completionRate: number;
  progress?: ProgressInfo;
}

export interface ParticipationRecord {
  id: string;
  status: string;
  participated_at: string;
  registered_at?: string;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  activity?: {
    id: string;
    name?: string;
    title?: string;
    activity_type?: string;
    activity_level?: string;
    hours?: number;
    start_date?: string;
  };
}

/**
 * Calculate comprehensive activity summary statistics
 */
export function calculateActivitySummary(participationHistory: ParticipationRecord[]): ActivitySummaryStats {
  // Remove duplicates - keep most recent participation per activity
  const uniqueActivities = new Map<string, ParticipationRecord>();
  
  participationHistory.forEach((participation) => {
    const activityId = participation.activity?.id;
    if (!activityId) return;
    
    const existing = uniqueActivities.get(activityId);
    if (!existing || new Date(participation.participated_at) > new Date(existing.participated_at)) {
      uniqueActivities.set(activityId, participation);
    }
  });

  const uniqueParticipations = Array.from(uniqueActivities.values());
  
  // Filter completed activities
  const completedParticipations = uniqueParticipations.filter(
    (p) => p.status === 'completed' || p.status === 'checked_out'
  );

  // Initialize counters
  let totalHours = 0;
  const facultyLevel = {
    activities: 0,
    hours: 0,
    byType: {} as Record<string, { count: number; hours: number }>
  };
  const universityLevel = {
    activities: 0,
    hours: 0,
    byType: {} as Record<string, { count: number; hours: number }>
  };

  // Process completed activities
  completedParticipations.forEach((participation) => {
    const activity = participation.activity;
    if (!activity) return;

    const hours = activity.hours || 0;
    const activityType = activity.activity_type || 'Other';
    const activityLevel = activity.activity_level;

    // Update total hours
    totalHours += hours;

    // Process by activity level
    if (activityLevel === 'faculty') {
      facultyLevel.activities++;
      facultyLevel.hours += hours;
      
      if (!facultyLevel.byType[activityType]) {
        facultyLevel.byType[activityType] = { count: 0, hours: 0 };
      }
      facultyLevel.byType[activityType].count++;
      facultyLevel.byType[activityType].hours += hours;
      
    } else if (activityLevel === 'university') {
      universityLevel.activities++;
      universityLevel.hours += hours;
      
      if (!universityLevel.byType[activityType]) {
        universityLevel.byType[activityType] = { count: 0, hours: 0 };
      }
      universityLevel.byType[activityType].count++;
      universityLevel.byType[activityType].hours += hours;
    }
  });

  // Calculate completion rate
  const completionRate = uniqueParticipations.length > 0 
    ? (completedParticipations.length / uniqueParticipations.length) * 100 
    : 0;

  return {
    totalActivities: uniqueParticipations.length,
    completedActivities: completedParticipations.length,
    totalHours,
    facultyLevel,
    universityLevel,
    completionRate: Math.round(completionRate * 100) / 100
  };
}

/**
 * Format activity type name for display
 */
export function getActivityTypeDisplayName(type: string): string {
  const typeMapping: Record<string, string> = {
    'Academic': 'วิชาการ',
    'Sports': 'กีฬา',
    'Cultural': 'ศิลปวัฒนธรรม',
    'Social': 'สังคมและบริการ',
    'Other': 'อื่นๆ'
  };
  
  return typeMapping[type] || type;
}

/**
 * Get activity level color for consistent styling
 */
export function getActivityLevelColor(level: string): {
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (level) {
    case 'university':
      return {
        bgClass: 'bg-blue-50 dark:bg-blue-950',
        textClass: 'text-blue-700 dark:text-blue-300',
        borderClass: 'border-blue-200 dark:border-blue-800'
      };
    case 'faculty':
      return {
        bgClass: 'bg-green-50 dark:bg-green-950',
        textClass: 'text-green-700 dark:text-green-300',
        borderClass: 'border-green-200 dark:border-green-800'
      };
    default:
      return {
        bgClass: 'bg-gray-50 dark:bg-gray-950',
        textClass: 'text-gray-700 dark:text-gray-300',
        borderClass: 'border-gray-200 dark:border-gray-800'
      };
  }
}

/**
 * Format hours for display with proper pluralization
 */
export function formatHoursDisplay(hours: number): string {
  if (hours === 0) return '0 ชั่วโมง';
  if (hours === 1) return '1 ชั่วโมง';
  return `${hours} ชั่วโมง`;
}

/**
 * Calculate percentage of total for a given value
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Calculate progress information based on requirements
 */
export function calculateProgress(stats: ActivitySummaryStats, requirements: ActivityRequirements): ProgressInfo {
  const facultyProgress = {
    current: stats.facultyLevel.hours,
    required: requirements.requiredFacultyHours,
    percentage: Math.min(100, calculatePercentage(stats.facultyLevel.hours, requirements.requiredFacultyHours)),
    remaining: Math.max(0, requirements.requiredFacultyHours - stats.facultyLevel.hours),
    isPassing: stats.facultyLevel.hours >= requirements.requiredFacultyHours
  };

  const universityProgress = {
    current: stats.universityLevel.hours,
    required: requirements.requiredUniversityHours,
    percentage: Math.min(100, calculatePercentage(stats.universityLevel.hours, requirements.requiredUniversityHours)),
    remaining: Math.max(0, requirements.requiredUniversityHours - stats.universityLevel.hours),
    isPassing: stats.universityLevel.hours >= requirements.requiredUniversityHours
  };

  const totalRequired = requirements.requiredFacultyHours + requirements.requiredUniversityHours;
  const totalCurrent = stats.facultyLevel.hours + stats.universityLevel.hours;
  
  const overallProgress = {
    current: totalCurrent,
    required: totalRequired,
    percentage: Math.min(100, calculatePercentage(totalCurrent, totalRequired)),
    remaining: Math.max(0, totalRequired - totalCurrent),
    isPassing: facultyProgress.isPassing && universityProgress.isPassing
  };

  return {
    facultyProgress,
    universityProgress,
    overallProgress
  };
}

/**
 * Calculate comprehensive activity summary with progress information
 */
export function calculateActivitySummaryWithProgress(
  participationHistory: ParticipationRecord[],
  requirements?: ActivityRequirements
): ActivitySummaryStats {
  const stats = calculateActivitySummary(participationHistory);
  
  if (requirements) {
    stats.progress = calculateProgress(stats, requirements);
  }
  
  return stats;
}

/**
 * Get progress color based on percentage
 */
export function getProgressColor(percentage: number, isPassing: boolean): {
  bgClass: string;
  textClass: string;
} {
  if (isPassing || percentage >= 100) {
    return {
      bgClass: 'bg-green-500',
      textClass: 'text-green-700 dark:text-green-300'
    };
  } else if (percentage >= 75) {
    return {
      bgClass: 'bg-blue-500',
      textClass: 'text-blue-700 dark:text-blue-300'
    };
  } else if (percentage >= 50) {
    return {
      bgClass: 'bg-yellow-500',
      textClass: 'text-yellow-700 dark:text-yellow-300'
    };
  } else {
    return {
      bgClass: 'bg-red-500',
      textClass: 'text-red-700 dark:text-red-300'
    };
  }
}
