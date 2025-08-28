import { requireSuperAdmin } from '$lib/server/auth-utils';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { adminCreateSchema } from '$lib/schemas/auth';
import type { PageServerLoad, Actions } from './$types';
import type { AdminRole, Organization } from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, organizations, departments } from '$lib/server/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const load: PageServerLoad = async (event) => {
	const user = requireSuperAdmin(event);

	// Load organizations directly from database
	let facultiesList: Organization[] = [];
	try {
		const facRows = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				code: organizations.code,
				description: organizations.description,
				status: organizations.status,
				created_at: organizations.createdAt,
				updated_at: organizations.updatedAt
			})
			.from(organizations)
			.where(eq(organizations.status, true))
			.orderBy(organizations.name);

		facultiesList = facRows.map((f) => ({
			...f,
			description: f.description || undefined,
			created_at: f.created_at?.toISOString() || new Date().toISOString(),
			updated_at: f.updated_at?.toISOString() || new Date().toISOString()
		}));
	} catch (error) {
		console.error('Failed to load organizations:', error);
	}

	// โหลดรายการแอดมินจากฐานข้อมูลโดยตรง (รวมข้อมูล user)
	let admins: AdminRole[] = [];
	try {
		const rows = await db
			.select({
				id: adminRoles.id,
				user_id: users.id,
				admin_level: adminRoles.adminLevel,
				organization_id: (adminRoles as any).organizationId,
				permissions: adminRoles.permissions,
				is_enabled: adminRoles.isEnabled,
				created_at: adminRoles.createdAt,
				updated_at: adminRoles.updatedAt,
				user_email: users.email,
				user_prefix: users.prefix,
				first_name: users.firstName,
				last_name: users.lastName,
				student_id: users.studentId,
				department_id: users.departmentId,
				user_created_at: users.createdAt,
				user_updated_at: users.updatedAt
			})
			.from(adminRoles)
			.innerJoin(users, eq(adminRoles.userId, users.id))
			.orderBy(desc(adminRoles.createdAt));

		const mapAdminLevel = (lvl: string): AdminLevel => {
			switch (lvl) {
				case 'super_admin':
					return AdminLevel.SuperAdmin;
				case 'organization_admin':
					return AdminLevel.OrganizationAdmin;
				case 'regular_admin':
				default:
					return AdminLevel.RegularAdmin;
			}
		};

		admins = rows.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			admin_level: mapAdminLevel(r.admin_level as unknown as string),
			organization_id: (r as any).organization_id || undefined,
			permissions: r.permissions || [],
			created_at: r.created_at?.toISOString() || new Date().toISOString(),
			updated_at: r.updated_at?.toISOString() || new Date().toISOString(),
			user: {
				id: r.user_id,
				student_id: r.student_id,
				email: r.user_email,
				prefix: r.user_prefix || 'Generic',
				first_name: r.first_name,
				last_name: r.last_name,
				department_id: r.department_id || undefined,
				organization_id: (r as any).organization_id || undefined,
				status: 'active',
				role: 'admin',
				created_at: r.user_created_at?.toISOString() || new Date().toISOString(),
				updated_at: r.user_updated_at?.toISOString() || new Date().toISOString()
			},
			organization: (r as any).organization_id
				? facultiesList.find((f) => f.id === (r as any).organization_id)
				: undefined,
			is_active: false,
			is_enabled: r.is_enabled ?? true
		}));
	} catch (error) {
		console.error('Failed to load admins:', error);
	}

	const form = await superValidate(zod(adminCreateSchema));

	return {
		user,
		admins,
		faculties: facultiesList,
		form
	};
};

// DB direct actions; removed API wrapper

export const actions: Actions = {
	create: async (event) => {
		const { request } = event;
		const form = await superValidate(request, zod(adminCreateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Default permissions by level
			const getDefaultPermissions = (level: string) => {
				switch (level) {
					case 'SuperAdmin':
						return [
							'ManageUsers',
							'ManageAdmins',
							'ManageActivities',
							'ViewDashboard',
							'ManageFaculties',
							'ManageSessions'
						];
					case 'OrganizationAdmin':
						return ['ViewDashboard', 'ManageActivities', 'ManageUsers'];
					default:
						return ['ViewDashboard'];
				}
			};

			// Map AdminLevel to DB enum string
			const toDbAdminLevel = (
				level: AdminLevel
			): 'super_admin' | 'organization_admin' | 'regular_admin' => {
				switch (level) {
					case AdminLevel.SuperAdmin:
						return 'super_admin';
					case AdminLevel.OrganizationAdmin:
						return 'organization_admin';
					case AdminLevel.RegularAdmin:
					default:
						return 'regular_admin';
				}
			};

			// Ensure email not taken
			const existing = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, form.data.email))
				.limit(1);
			if (existing.length > 0) {
				form.errors._errors = ['อีเมลนี้ถูกใช้งานแล้ว'];
				return fail(400, { form });
			}

			// Prepare required fields for users table
			const passwordHash = await bcrypt.hash(form.data.password, 10);
			const qrSecret = crypto.randomBytes(16).toString('hex');
			const genStudentId = () => 'A' + Math.floor(100000000 + Math.random() * 900000000).toString();

			let studentId = genStudentId();
			for (let i = 0; i < 3; i++) {
				const exists = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.studentId, studentId))
					.limit(1);
				if (exists.length === 0) break;
				studentId = genStudentId();
			}

			// Insert user
			const [newUser] = await db
				.insert(users)
				.values({
					studentId,
					email: form.data.email,
					passwordHash,
					prefix: form.data.prefix,
					firstName: form.data.first_name,
					lastName: form.data.last_name,
					qrSecret,
					status: 'active'
				})
				.returning({ id: users.id });

			// Insert admin role
			const perms = form.data.permissions?.length
				? form.data.permissions
				: getDefaultPermissions(form.data.admin_level);
			await db.insert(adminRoles).values({
				userId: newUser.id,
				adminLevel: toDbAdminLevel(form.data.admin_level),
				organizationId:
					form.data.admin_level === AdminLevel.OrganizationAdmin
						? (form.data as any).organization_id || null
						: null,
				permissions: perms,
				isEnabled: true
			});

			return { form, success: true, message: 'สร้างแอดมินสำเร็จ' };
		} catch (error) {
			console.error('Create admin error:', error);

			// ตรวจสอบประเภทของ error เพื่อให้ข้อความที่เหมาะสม
			if (error instanceof TypeError && error.message.includes('fetch')) {
				form.errors._errors = [
					'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาตรวจสอบว่า Backend Server กำลังทำงานอยู่'
				];
			} else if (error instanceof Error) {
				form.errors._errors = [`เกิดข้อผิดพลาด: ${error.message}`];
			} else {
				form.errors._errors = ['เกิดข้อผิดพลาดไม่ทราบสาเหตุในการสร้างแอดมิน'];
			}
			return fail(500, { form });
		}
	},

	delete: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const adminId = formData.get('adminId') as string;

		if (!adminId) {
			return fail(400, { error: 'ไม่พบ ID ของแอดมิน' });
		}

		try {
			await db.delete(users).where(eq(users.id, adminId));
			return { success: true, message: 'ลบแอดมินสำเร็จ' };
		} catch (error) {
			console.error('Delete admin error:', error);

			if (error instanceof TypeError && error.message.includes('fetch')) {
				return fail(500, { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
			} else if (error instanceof SyntaxError) {
				return fail(500, { error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลจากเซิร์ฟเวอร์' });
			}
			return fail(500, { error: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการลบแอดมิน' });
		}
	},

	toggleStatus: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const adminId = formData.get('adminId') as string; // admin role id
		const isActive = formData.get('isActive') === 'true';

		if (!adminId) {
			return fail(400, { error: 'ไม่พบ ID ของแอดมิน' });
		}

		try {
			await db
				.update(adminRoles)
				.set({ isEnabled: isActive, updatedAt: new Date() })
				.where(eq(adminRoles.id, adminId));
			return { success: true, message: `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แอดมินสำเร็จ` };
		} catch (error) {
			console.error('Toggle admin status error:', error);

			if (error instanceof TypeError && error.message.includes('fetch')) {
				return fail(500, { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
			} else if (error instanceof SyntaxError) {
				return fail(500, { error: 'เซิร์ฟเวอร์ส่งข้อมูลที่ไม่ถูกต้อง' });
			} else if (error instanceof Error) {
				return fail(500, { error: `เกิดข้อผิดพลาด: ${error.message}` });
			} else {
				return fail(500, { error: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการเปลี่ยนสถานะแอดมิน' });
			}
		}
	},

	update: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const adminId = formData.get('adminId') as string;
		const userId = formData.get('userId') as string; // รับ user_id แทน admin_id
		const updateDataString = formData.get('updateData') as string;

		if (!adminId && !userId) {
			return fail(400, { error: 'ไม่พบ ID ของแอดมิน' });
		}

		if (!updateDataString) {
			return fail(400, { error: 'ไม่พบข้อมูลที่ต้องการอัพเดต' });
		}

		// ใช้ userId หากมี, ถ้าไม่มีให้ใช้ adminId
		const targetUserId = userId || adminId;

		let updateData;
		try {
			updateData = JSON.parse(updateDataString);
		} catch (parseError) {
			console.error('JSON parse error:', parseError, 'Raw data:', updateDataString);
			return fail(400, { error: 'ข้อมูลที่ส่งมาไม่อยู่ในรูปแบบที่ถูกต้อง' });
		}

		try {
			// ตรวจสอบว่ามีข้อมูลที่จำเป็นครบถ้วน
			const requiredFields = ['first_name', 'last_name', 'email'];
			const missingFields = requiredFields.filter((field) => !updateData[field]);

			if (missingFields.length > 0) {
				return fail(400, {
					error: `ข้อมูลไม่ครบถ้วน: ${missingFields.join(', ')}`
				});
			}

			const setObj: any = {
				firstName: updateData.first_name,
				lastName: updateData.last_name,
				email: updateData.email,
				updatedAt: new Date()
			};
			if (updateData.prefix !== undefined) {
				setObj.prefix = updateData.prefix || 'Generic';
			}
			if (updateData.department_id !== undefined) {
				setObj.departmentId = updateData.department_id || null;
			}

			await db.update(users).set(setObj).where(eq(users.id, targetUserId));

			return {
				success: true,
				message: 'อัพเดตข้อมูลแอดมินสำเร็จ'
			};
		} catch (error) {
			console.error('Update admin error:', error);

			// ให้ error handling ที่ดีขึ้น
			if (error instanceof TypeError && error.message.includes('fetch')) {
				return fail(500, {
					error:
						'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาตรวจสอบว่า Backend Server กำลังทำงานอยู่'
				});
			} else if (error instanceof SyntaxError) {
				return fail(500, { error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลจากเซิร์ฟเวอร์' });
			} else if (error instanceof Error) {
				return fail(500, { error: `เกิดข้อผิดพลาด: ${error.message}` });
			} else {
				return fail(500, { error: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการอัพเดตข้อมูลแอดมิน' });
			}
		}
	}
};
