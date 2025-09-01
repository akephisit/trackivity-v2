import type { ActivityStatus } from '$lib/types/activity';

/**
 * แปลงค่า ActivityStatus จากรูปแบบ frontend (lowercase) เป็น backend (capitalized)
 * Frontend: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled'
 * Backend: 'Draft' | 'Published' | 'Ongoing' | 'Completed' | 'Cancelled'
 */
export function convertStatusForBackend(status: ActivityStatus): string {
	const statusMapping: Record<ActivityStatus, string> = {
		draft: 'Draft',
		published: 'Published',
		ongoing: 'Ongoing',
		completed: 'Completed',
		cancelled: 'Cancelled'
	};

	return statusMapping[status] || status;
}

/**
 * แปลงค่า ActivityStatus จากรูปแบบ backend (capitalized) เป็น frontend (lowercase)
 * Backend: 'Draft' | 'Published' | 'Ongoing' | 'Completed' | 'Cancelled'
 * Frontend: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled'
 */
export function convertStatusFromBackend(status: string): ActivityStatus {
	const statusMapping: Record<string, ActivityStatus> = {
		Draft: 'draft',
		Published: 'published',
		Ongoing: 'ongoing',
		Completed: 'completed',
		Cancelled: 'cancelled'
	};

	return statusMapping[status] || (status.toLowerCase() as ActivityStatus);
}

/**
 * ตรวจสอบว่า status string เป็นค่าที่ valid หรือไม่
 */
export function isValidActivityStatus(status: string): status is ActivityStatus {
	const validStatuses: ActivityStatus[] = [
		'draft',
		'published',
		'ongoing',
		'completed',
		'cancelled'
	];
	return validStatuses.includes(status as ActivityStatus);
}

/**
 * แปลงค่า ActivityLevel จากรูปแบบ English เป็น Thai สำหรับแสดงผล
 * English: 'faculty' | 'university'
 * Thai: 'คณะ' | 'มหาวิทยาลัย'
 */
export function getActivityLevelDisplayName(level: string): string {
	const levelMapping: Record<string, string> = {
		faculty: 'คณะ',
		university: 'มหาวิทยาลัย'
	};

	return levelMapping[level] || level;
}

/**
 * แปลงค่า ActivityLevel จากรูปแบบ Thai เป็น English สำหรับจัดเก็บ
 * Thai: 'คณะ' | 'มหาวิทยาลัย'
 * English: 'faculty' | 'university'
 */
export function convertActivityLevelFromThai(thaiLevel: string): string {
	const levelMapping: Record<string, string> = {
		'คณะ': 'faculty',
		'มหาวิทยาลัย': 'university'
	};

	return levelMapping[thaiLevel] || 'faculty'; // Default to faculty
}

/**
 * ตรวจสอบว่า activity level string เป็นค่าที่ valid หรือไม่
 */
export function isValidActivityLevel(level: string): boolean {
	const validLevels = ['faculty', 'university'];
	return validLevels.includes(level);
}

/**
 * รายการตัวเลือก ActivityLevel พร้อม label ภาษาไทย
 */
export const activityLevelOptions = [
	{ 
		value: 'faculty' as const, 
		label: 'คณะ', 
		description: 'กิจกรรมระดับคณะ' 
	},
	{ 
		value: 'university' as const, 
		label: 'มหาวิทยาลัย', 
		description: 'กิจกรรมระดับมหาวิทยาลัย' 
	}
];
