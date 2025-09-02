import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Convert role values to Thai display names
 * @param role - The role value from database
 * @returns Thai display name for the role
 */
export function getRoleText(role: string): string {
	const roleTranslations: Record<string, string> = {
		super_admin: 'ผู้ดูแลระบบ',
		organization_admin: 'ผู้ดูแลหน่วยงาน',
		faculty_admin: 'ผู้ดูแลคณะ',
		regular_admin: 'ผู้ดูแลทั่วไป',
		admin: 'ผู้ดูแลระบบ',
		teacher: 'อาจารย์',
		faculty: 'อาจารย์',
		staff: 'เจ้าหน้าที่',
		student: 'นิสิต',
		user: 'ผู้ใช้'
	};
	
	return roleTranslations[role] || role;
}

/**
 * Get badge variant for role display
 * @param role - The role value from database
 * @returns Badge variant for UI styling
 */
export function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		super_admin: 'destructive',
		organization_admin: 'default',
		faculty_admin: 'default',
		regular_admin: 'secondary',
		admin: 'secondary',
		teacher: 'default',
		faculty: 'default',
		staff: 'secondary',
		student: 'outline',
		user: 'outline'
	};
	
	return variants[role] || 'outline';
}
