import { requireSuperAdmin } from '$lib/server/auth-utils';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { adminCreateSchema } from '$lib/schemas/auth';
import type { PageServerLoad, Actions } from './$types';
import type { AdminRole, Faculty } from '$lib/types/admin';
import { AdminLevel } from '$lib/types/admin';
import { db, users, adminRoles, faculties, departments } from '$lib/server/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = requireSuperAdmin(event);

	// Load faculties directly from database
	let facultiesList: Faculty[] = [];
	try {
		const facRows = await db
			.select({
				id: faculties.id,
				name: faculties.name,
				code: faculties.code,
				description: faculties.description,
				status: faculties.status,
				created_at: faculties.createdAt,
				updated_at: faculties.updatedAt
			})
			.from(faculties)
			.where(eq(faculties.status, true))
			.orderBy(faculties.name);

		facultiesList = facRows.map((f) => ({
			...f,
			description: f.description || undefined,
			created_at: f.created_at?.toISOString() || new Date().toISOString(),
			updated_at: f.updated_at?.toISOString() || new Date().toISOString()
		}));
	} catch (error) {
		console.error('Failed to load faculties:', error);
	}

	// โหลดรายการแอดมินจากฐานข้อมูลโดยตรง (รวมข้อมูล user)
	let admins: AdminRole[] = [];
	try {
		const rows = await db
			.select({
				id: adminRoles.id,
				user_id: users.id,
				admin_level: adminRoles.adminLevel,
				faculty_id: adminRoles.facultyId,
				permissions: adminRoles.permissions,
				is_enabled: adminRoles.isEnabled,
				created_at: adminRoles.createdAt,
				updated_at: adminRoles.updatedAt,
				user_email: users.email,
				first_name: users.firstName,
				last_name: users.lastName,
				student_id: users.studentId,
				department_id: users.departmentId,
				user_created_at: users.createdAt,
				user_updated_at: users.updatedAt,
			})
			.from(adminRoles)
			.innerJoin(users, eq(adminRoles.userId, users.id))
			.orderBy(desc(adminRoles.createdAt));

		const mapAdminLevel = (lvl: string): AdminLevel => {
			switch (lvl) {
				case 'super_admin':
					return AdminLevel.SuperAdmin;
				case 'faculty_admin':
					return AdminLevel.FacultyAdmin;
				case 'regular_admin':
				default:
					return AdminLevel.RegularAdmin;
			}
		};

		admins = rows.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			admin_level: mapAdminLevel(r.admin_level as unknown as string),
			faculty_id: r.faculty_id || undefined,
			permissions: r.permissions || [],
			created_at: r.created_at?.toISOString() || new Date().toISOString(),
			updated_at: r.updated_at?.toISOString() || new Date().toISOString(),
			user: {
				id: r.user_id,
				student_id: r.student_id,
				email: r.user_email,
				first_name: r.first_name,
				last_name: r.last_name,
				department_id: r.department_id || undefined,
				faculty_id: r.faculty_id || undefined,
				status: 'active',
				role: 'admin',
				created_at: r.user_created_at?.toISOString() || new Date().toISOString(),
				updated_at: r.user_updated_at?.toISOString() || new Date().toISOString()
			},
			faculty: r.faculty_id ? facultiesList.find((f) => f.id === r.faculty_id) : undefined,
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

// Minimal server-side API wrapper using event.fetch to preserve cookies
const api = {
	get: async (event: any, url: string) => {
		const res = await event.fetch(url);
		return res.json();
	},
	post: async (event: any, url: string, body?: any) => {
		const res = await event.fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
		return res.json();
	},
	put: async (event: any, url: string, body?: any) => {
		const res = await event.fetch(url, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
		return res.json();
	},
	delete: async (event: any, url: string) => {
		const res = await event.fetch(url, { method: 'DELETE' });
		return res.json();
	}
};

export const actions: Actions = {
	create: async (event) => {
		const { request } = event;
		const form = await superValidate(request, zod(adminCreateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Define default permissions based on admin level
			const getDefaultPermissions = (adminLevel: string, _facultyId?: string) => {
				switch (adminLevel) {
					case 'SuperAdmin':
						return [
							'ManageUsers',
							'ManageAdmins',
							'ManageActivities',
							'ViewDashboard',
							'ManageFaculties',
							'ManageSessions'
						];
					case 'FacultyAdmin':
						return [
							'ViewDashboard',
							'ManageActivities',
							'ManageUsers'
						];
					case 'RegularAdmin':
					default:
						return [
							'ViewDashboard',
							'ManageActivities'
						];
				}
			};

			// Transform form data to match backend expectations
			const transformedData = {
				student_id: `A${Date.now()}`, // Generate temporary student_id for admin with prefix
				email: form.data.email,
				password: form.data.password || 'TempPass123!', // Use provided password or temp password
				prefix: form.data.prefix, // Add prefix field
				first_name: form.data.first_name,
				last_name: form.data.last_name,
				department_id: null,
				admin_level: form.data.admin_level, // ใช้ admin_level ที่ส่งมาจาก form โดยตรง
				faculty_id: form.data.faculty_id && form.data.faculty_id !== '' ? form.data.faculty_id : null,
				permissions: getDefaultPermissions(form.data.admin_level, form.data.faculty_id)
			};

			console.log('Creating admin with data:', {
				admin_level: transformedData.admin_level,
				faculty_id: transformedData.faculty_id,
				permissions: transformedData.permissions,
				form_data_admin_level: form.data.admin_level,
				form_data_faculty_id: form.data.faculty_id
			});

			
        const response = await api.post(event, '/api/admin/create', transformedData);

        if (!response.success) {
            form.errors._errors = [response.error || 'เกิดข้อผิดพลาดในการสร้างแอดมิน'];
            return fail(400, { form });
        }

        if (response.success) {
            return { form, success: true, message: 'สร้างแอดมินสำเร็จ' };
        } else {
            form.errors._errors = ['เกิดข้อผิดพลาดในการสร้างแอดมิน'];
            return fail(400, { form });
        }
		} catch (error) {
			console.error('Create admin error:', error);
			
			// ตรวจสอบประเภทของ error เพื่อให้ข้อความที่เหมาะสม
			if (error instanceof TypeError && error.message.includes('fetch')) {
				form.errors._errors = ['เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาตรวจสอบว่า Backend Server กำลังทำงานอยู่'];
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
        const response = await api.delete(event, `/api/users/${adminId}`);

        if (!response.success) {
            return fail(400, { 
                error: response.error || 'เกิดข้อผิดพลาดในการลบแอดมิน' 
            });
        }

        if (response.success) {
            return { 
                success: true, 
                message: 'ลบแอดมินสำเร็จ' 
            };
        } else {
            return fail(400, { 
                error: 'เกิดข้อผิดพลาดในการลบแอดมิน' 
            });
        }
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
        const response = await api.put(event, `/api/admin/roles/${adminId}/toggle-status`, {
            is_enabled: isActive  // Send is_enabled instead of is_active
        });

        if (!response.success) {
            return fail(400, { 
                error: response.error || `เกิดข้อผิดพลาดในการ${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แอดมิน` 
            });
        }

        if (response.success) {
            return { 
                success: true, 
                message: response.message || `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แอดมินสำเร็จ`,
                data: response.data
            };
        } else {
            return fail(400, { 
                error: `เกิดข้อผิดพลาดในการ${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แอดมิน` 
            });
        }
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
			const missingFields = requiredFields.filter(field => !updateData[field]);
			
			if (missingFields.length > 0) {
				return fail(400, { 
					error: `ข้อมูลไม่ครบถ้วน: ${missingFields.join(', ')}` 
				});
			}

			// เตรียมข้อมูลสำหรับส่งไป backend ผ่าน user endpoint
			// ตาม API structure ใน backend/handlers/user.rs
			const preparedData = {
				first_name: updateData.first_name,
				last_name: updateData.last_name,
				email: updateData.email,
				// department_id สำหรับ user update
				...(updateData.department_id !== undefined && { department_id: updateData.department_id || null })
				// Note: admin_level และ permissions จะต้องจัดการแยกผ่าน admin_roles table
				// ซึ่งตอนนี้ backend ยังไม่มี endpoint สำหรับนั้น
			};

			// ใช้ user endpoint ตาม backend routes
        const response = await api.put(event, `/api/users/${targetUserId}`, preparedData);

        if (!response.success) {
            return fail(400, { 
                error: response.error || 'เกิดข้อผิดพลาดในการอัพเดตข้อมูลแอดมิน' 
            });
        }

        if (response.success) {
            return { 
                success: true, 
                message: 'อัพเดตข้อมูลแอดมินสำเร็จ',
                data: response.data
            };
        } else {
            return fail(400, { 
                error: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูลแอดมิน' 
            });
        }
		} catch (error) {
			console.error('Update admin error:', error);
			
			// ให้ error handling ที่ดีขึ้น
			if (error instanceof TypeError && error.message.includes('fetch')) {
				return fail(500, { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาตรวจสอบว่า Backend Server กำลังทำงานอยู่' });
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
