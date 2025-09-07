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
		คณะ: 'faculty',
		มหาวิทยาลัย: 'university'
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
 * แปลงค่า ActivityType จากรูปแบบ English เป็น Thai สำหรับแสดงผล
 * English: 'Academic' | 'Sports' | 'Cultural' | 'Social' | 'Other'
 * Thai: 'วิชาการ' | 'กีฬา' | 'วัฒนธรรม' | 'สังคม' | 'อื่นๆ'
 */
export function getActivityTypeDisplayName(type: string): string {
	const typeMapping: Record<string, string> = {
		Academic: 'วิชาการ',
		Sports: 'กีฬา',
		Cultural: 'วัฒนธรรม',
		Social: 'สังคม',
		Other: 'อื่นๆ'
	};

	return typeMapping[type] || type;
}

/**
 * แปลงค่า ActivityType จากรูปแบบ Thai เป็น English สำหรับจัดเก็บ
 * Thai: 'วิชาการ' | 'กีฬา' | 'วัฒนธรรม' | 'สังคม' | 'อื่นๆ'
 * English: 'Academic' | 'Sports' | 'Cultural' | 'Social' | 'Other'
 */
export function convertActivityTypeFromThai(thaiType: string): string {
	const typeMapping: Record<string, string> = {
		วิชาการ: 'Academic',
		กีฬา: 'Sports',
		วัฒนธรรม: 'Cultural',
		สังคม: 'Social',
		อื่นๆ: 'Other'
	};

	return typeMapping[thaiType] || 'Other'; // Default to Other
}

/**
 * ตรวจสอบว่า activity type string เป็นค่าที่ valid หรือไม่
 */
export function isValidActivityType(type: string): boolean {
	const validTypes = ['Academic', 'Sports', 'Cultural', 'Social', 'Other'];
	return validTypes.includes(type);
}

/**
 * รายการตัวเลือก ActivityType พร้อม label ภาษาไทย
 */
export const activityTypeOptions = [
	{
		value: 'Academic' as const,
		label: 'วิชาการ',
		description: 'กิจกรรมทางการศึกษาและการเรียนรู้'
	},
	{
		value: 'Sports' as const,
		label: 'กีฬา',
		description: 'กิจกรรมกีฬาและการออกกำลังกาย'
	},
	{
		value: 'Cultural' as const,
		label: 'วัฒนธรรม',
		description: 'กิจกรรมด้านศิลปะและวัฒนธรรม'
	},
	{
		value: 'Social' as const,
		label: 'สังคม',
		description: 'กิจกรรมเพื่อสังคมและการพัฒนาชุมชน'
	},
	{
		value: 'Other' as const,
		label: 'อื่นๆ',
		description: 'กิจกรรมประเภทอื่นๆ'
	}
];

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
