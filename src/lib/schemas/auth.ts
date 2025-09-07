import { z } from 'zod';
import { AdminLevel } from '$lib/types/admin';

export const loginSchema = z.object({
	student_id: z
		.string()
		.min(1, 'กรุณาใส่รหัสนักศึกษา')
		.regex(/^[0-9]+$/, 'รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น')
		.min(8, 'รหัสนักศึกษาต้องมีอย่างน้อย 8 หลัก'),
	password: z.string().min(1, 'กรุณาใส่รหัสผ่าน').min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
	remember_me: z.boolean().optional().default(false)
});

// Admin login schema (uses email instead of student_id)
export const adminLoginSchema = z.object({
	email: z.string().min(1, 'กรุณาใส่อีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
	password: z.string().min(1, 'กรุณาใส่รหัสผ่าน').min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
	remember_me: z.boolean().optional().default(false)
});

// Define Thai prefix options (all 9 options for admin)
export const PrefixOptions = [
	{ value: 'Mr', label: 'นาย' },
	{ value: 'Mrs', label: 'นาง' },
	{ value: 'Miss', label: 'นางสาว' },
	{ value: 'Dr', label: 'ดร.' },
	{ value: 'Professor', label: 'ศาสตราจารย์' },
	{ value: 'AssociateProfessor', label: 'รองศาสตราจารย์' },
	{ value: 'AssistantProfessor', label: 'ผู้ช่วยศาสตราจารย์' },
	{ value: 'Lecturer', label: 'อาจารย์' },
	{ value: 'Generic', label: 'คุณ' }
] as const;

// Basic prefix options for student registration (only 3 basic ones)
export const BasicPrefixOptions = [
	{ value: 'Mr', label: 'นาย' },
	{ value: 'Mrs', label: 'นาง' },
	{ value: 'Miss', label: 'นางสาว' }
] as const;

// Student registration schema with prefix support
export const registerSchema = z
	.object({
		prefix: z
			.string()
			.min(1, 'กรุณาเลือกคำนำหน้า')
			.refine((val) => BasicPrefixOptions.some((option) => option.value === val), {
				message: 'กรุณาเลือกคำนำหน้าที่ถูกต้อง'
			}),
		first_name: z
			.string()
			.min(1, 'กรุณาใส่ชื่อจริง')
			.min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
			.max(50, 'ชื่อต้องไม่เกิน 50 ตัวอักษร'),
		last_name: z
			.string()
			.min(1, 'กรุณาใส่นามสกุล')
			.min(2, 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร')
			.max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร'),
		student_id: z
			.string()
			.min(1, 'กรุณาใส่รหัสนักเรียน')
			.regex(/^[0-9]+$/, 'รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น')
			.min(8, 'รหัสนักเรียนต้องมีอย่างน้อย 8 หลัก'),
		email: z.string().min(1, 'กรุณาใส่อีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
		password: z
			.string()
			.min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
			.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'รหัสผ่านต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข'),
		confirmPassword: z.string().min(1, 'กรุณายืนยันรหัสผ่าน'),
		organization_id: z.string().min(1, 'กรุณาเลือกหน่วยงาน'),
		department_id: z.string().min(1, 'กรุณาเลือกสาขาวิชา')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'รหัสผ่านไม่ตรงกัน',
		path: ['confirmPassword']
	});

export const adminCreateSchema = z
	.object({
		prefix: z
			.string()
			.min(1, 'กรุณาเลือกคำนำหน้า')
			.refine((val) => PrefixOptions.some((option) => option.value === val), {
				message: 'กรุณาเลือกคำนำหน้าที่ถูกต้อง'
			}),
		first_name: z
			.string()
			.min(1, 'กรุณาใส่ชื่อจริง')
			.min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
			.max(50, 'ชื่อต้องไม่เกิน 50 ตัวอักษร'),
		last_name: z
			.string()
			.min(1, 'กรุณาใส่นามสกุล')
			.min(2, 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร')
			.max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร'),
		email: z.string().min(1, 'กรุณาใส่อีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
		password: z
			.string()
			.min(1, 'กรุณาใส่รหัสผ่าน')
			.min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
			.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'รหัสผ่านต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข'),
		admin_level: z.nativeEnum(AdminLevel, {
			message: 'กรุณาเลือกระดับแอดมิน'
		}),
		organization_id: z
			.string()
			.optional()
			.refine(
				(val) =>
					!val ||
					val === '' ||
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
				{
					message: 'รูปแบบ Organization ID ไม่ถูกต้อง'
				}
			),
		permissions: z.array(z.string()).default([])
	})
	.refine(
		(data) => {
			// OrganizationAdmin ต้องมี organization_id
			if (
				data.admin_level === AdminLevel.OrganizationAdmin &&
				(!(data as any).organization_id || (data as any).organization_id === '')
			) {
				return false;
			}
			return true;
		},
		{
			message: 'แอดมินระดับหน่วยงานต้องระบุหน่วยงาน',
			path: ['organization_id']
		}
	);

export const adminUpdateSchema = z.object({
	id: z.number().positive('ID ไม่ถูกต้อง'),
	email: z.string().min(1, 'กรุณาใส่อีเมล').email('รูปแบบอีเมลไม่ถูกต้อง').optional(),
	name: z
		.string()
		.min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
		.max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร')
		.optional(),
	admin_level: z.nativeEnum(AdminLevel).optional(),
	organization_id: z.number().positive('กรุณาเลือกหน่วยงาน').optional(),
	permissions: z.array(z.string()).optional()
});

// Profile update schema
export const profileUpdateSchema = z.object({
	prefix: z
		.string()
		.min(1, 'กรุณาเลือกคำนำหน้า')
		.refine((val) => PrefixOptions.some((option) => option.value === val), {
			message: 'กรุณาเลือกคำนำหน้าที่ถูกต้อง'
		}),
	first_name: z
		.string()
		.min(1, 'กรุณาใส่ชื่อจริง')
		.min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
		.max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
	last_name: z
		.string()
		.min(1, 'กรุณาใส่นามสกุล')
		.min(2, 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร')
		.max(100, 'นามสกุลต้องไม่เกิน 100 ตัวอักษร'),
	email: z
		.string()
		.min(1, 'กรุณาใส่อีเมล')
		.email('รูปแบบอีเมลไม่ถูกต้อง')
		.max(255, 'อีเมลยาวเกินไป'),
	phone: z
		.string()
		.optional()
		.refine((phone) => {
			if (!phone || phone.trim() === '') return true;
			// Thai phone number validation (10 digits, starting with 0)
			const phoneRegex = /^0[0-9]{9}$/;
			return phoneRegex.test(phone.replace(/[^\d]/g, ''));
		}, 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 10 หลัก เริ่มด้วย 0)'),
	address: z.string().max(500, 'ที่อยู่ยาวเกินไป').optional()
});

// Password change schema
export const changePasswordSchema = z
	.object({
		current_password: z.string().min(1, 'กรุณาใส่รหัสผ่านปัจจุบัน'),
		new_password: z
			.string()
			.min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
			.max(128, 'รหัสผ่านยาวเกินไป')
			.refine((password) => {
				// Password must contain at least one letter and one number
				return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
			}, 'รหัสผ่านต้องมีตัวอักษรและตัวเลขอย่างน้อย 1 ตัว'),
		confirm_password: z.string().min(1, 'กรุณายืนยันรหัสผ่าน')
	})
	.refine((data) => data.new_password === data.confirm_password, {
		message: 'การยืนยันรหัสผ่านไม่ตรงกัน',
		path: ['confirm_password']
	});

export type LoginFormData = z.infer<typeof loginSchema>;
export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type AdminCreateFormData = z.infer<typeof adminCreateSchema>;
export type AdminUpdateFormData = z.infer<typeof adminUpdateSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
