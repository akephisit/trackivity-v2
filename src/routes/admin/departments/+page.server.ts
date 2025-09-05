import { redirect, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import type { Department, Organization } from '$lib/types/admin';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, organizations, departments, users, adminRoles } from '$lib/server/db';
import { eq, and, desc, count, sql } from 'drizzle-orm';

// Department schemas
const departmentCreateSchema = z.object({
	name: z.string().min(1, 'กรุณากรอกชื่อภาควิชา'),
	code: z.string().min(1, 'กรุณากรอกรหัสภาควิชา'),
	description: z.string().optional(),
	status: z.preprocess((val) => {
		if (val === 'true' || val === true) return true;
		if (val === 'false' || val === false) return false;
		return true; // default value
	}, z.boolean()).default(true),
	// สำหรับ SuperAdmin ต้องเลือกหน่วยงาน
	organization_id: z.string().uuid('รหัสหน่วยงานไม่ถูกต้อง').optional()
});

const departmentUpdateSchema = z.object({
	name: z.string().min(1, 'กรุณากรอกชื่อภาควิชา').optional(),
	code: z.string().min(1, 'กรุณากรอกรหัสภาควิชา').optional(),
	description: z.string().optional(),
	status: z.boolean().optional()
});

export const load: PageServerLoad = async (event) => {
	const { depends } = event;
	depends('app:page-data');

	// Ensure user is authenticated as admin
	const user = requireAdmin(event);
	const admin_role = user.admin_role;

	try {
		// Fetch departments with student and admin counts
		let departmentsData: Department[];
		if (admin_role?.admin_level === 'OrganizationAdmin' && (admin_role as any).organization_id) {
			// Get departments for specific organization
			const rows = await db
				.select({
					id: departments.id,
					name: departments.name,
					code: departments.code,
					organization_id: departments.organizationId,
					description: departments.description,
					status: departments.status,
					created_at: departments.createdAt,
					updated_at: departments.updatedAt,
					students_count: sql<number>`CAST(COUNT(DISTINCT ${users.id}) AS INTEGER)`,
					// Count admins for this organization (organization-level admins)
					admins_count: sql<number>`0` // Will calculate separately
				})
				.from(departments)
				.leftJoin(users, eq(departments.id, users.departmentId))
				.where(eq(departments.organizationId, (admin_role as any).organization_id))
				.groupBy(departments.id, departments.name, departments.code, departments.organizationId, departments.description, departments.status, departments.createdAt, departments.updatedAt)
				.orderBy(desc(departments.createdAt));

			// Get admin count for the organization
			const adminCountResult = await db
				.select({ count: count() })
				.from(adminRoles)
				.where(eq(adminRoles.organizationId, (admin_role as any).organization_id));
			
			const totalAdmins = adminCountResult[0]?.count || 0;

			departmentsData = rows.map((d) => ({
				...d,
				description: d.description || undefined,
				created_at: d.created_at?.toISOString() || new Date().toISOString(),
				updated_at: d.updated_at?.toISOString() || new Date().toISOString(),
				students_count: d.students_count || 0,
				admins_count: totalAdmins // All admins belong to the organization
			}));
		} else {
			// SuperAdmin - get all departments with organization info and counts
			const rows = await db
				.select({
					id: departments.id,
					name: departments.name,
					code: departments.code,
					organization_id: departments.organizationId,
					description: departments.description,
					status: departments.status,
					created_at: departments.createdAt,
					updated_at: departments.updatedAt,
					organization_name: organizations.name,
					students_count: sql<number>`CAST(COUNT(DISTINCT ${users.id}) AS INTEGER)`
				})
				.from(departments)
				.leftJoin(organizations, eq(departments.organizationId, organizations.id))
				.leftJoin(users, eq(departments.id, users.departmentId))
				.groupBy(departments.id, departments.name, departments.code, departments.organizationId, departments.description, departments.status, departments.createdAt, departments.updatedAt, organizations.name)
				.orderBy(desc(departments.createdAt));

			// Get total admin count for SuperAdmin view
			const adminCountResult = await db.select({ count: count() }).from(adminRoles);
			const totalAdmins = adminCountResult[0]?.count || 0;

			departmentsData = rows.map((d) => ({
				...d,
				description: d.description || undefined,
				created_at: d.created_at?.toISOString() || new Date().toISOString(),
				updated_at: d.updated_at?.toISOString() || new Date().toISOString(),
				students_count: d.students_count || 0,
				admins_count: totalAdmins // Total system admins for SuperAdmin view
			}));
		}

		// For OrganizationAdmin, get their organization info
		let currentFaculty: Organization | null = null;
		if (admin_role?.admin_level === 'OrganizationAdmin' && (admin_role as any).organization_id) {
			const facRows = await db
				.select({
					id: organizations.id,
					name: organizations.name,
					code: organizations.code,
					description: organizations.description,
					organizationType: organizations.organizationType,
					status: organizations.status,
					created_at: organizations.createdAt,
					updated_at: organizations.updatedAt
				})
				.from(organizations)
				.where(eq(organizations.id, (admin_role as any).organization_id))
				.limit(1);

			if (facRows.length > 0) {
				const f = facRows[0];
				currentFaculty = {
					...f,
					description: f.description || undefined,
					created_at: f.created_at?.toISOString() || new Date().toISOString(),
					updated_at: f.updated_at?.toISOString() || new Date().toISOString()
				};
			}

			// If organization type is 'office', block access to departments page
			if (currentFaculty && currentFaculty.organizationType !== 'faculty') {
				throw redirect(303, '/unauthorized');
			}
		}

		// If SuperAdmin, load faculty-type organizations list for selection
		let facultiesList: Organization[] | null = null;
		if (admin_role?.admin_level === 'SuperAdmin') {
			const facRows = await db
				.select({
					id: organizations.id,
					name: organizations.name,
					code: organizations.code,
					description: organizations.description,
					organizationType: organizations.organizationType,
					status: organizations.status,
					created_at: organizations.createdAt,
					updated_at: organizations.updatedAt
				})
				.from(organizations)
				.where(and(eq(organizations.status, true), eq(organizations.organizationType, 'faculty')))
				.orderBy(organizations.name);

			facultiesList = facRows.map((f) => ({
				...f,
				description: f.description || undefined,
				created_at: f.created_at?.toISOString() || new Date().toISOString(),
				updated_at: f.updated_at?.toISOString() || new Date().toISOString()
			}));
		}

		// Create forms
		const createForm = await superValidate(zod(departmentCreateSchema));
		const updateForm = await superValidate(zod(departmentUpdateSchema));

		return {
			departments: departmentsData,
			currentFaculty,
			createForm,
			updateForm,
			userRole: admin_role?.admin_level || 'RegularAdmin',
			faculties: facultiesList
		};
	} catch (error) {
		console.error('Failed to load departments data:', error);
		return {
			departments: [],
			currentFaculty: null,
			createForm: await superValidate(zod(departmentCreateSchema)),
			updateForm: await superValidate(zod(departmentUpdateSchema)),
			userRole: admin_role?.admin_level || 'RegularAdmin',
			faculties: null
		};
	}
};

export const actions: Actions = {
	create: async (event) => {
		const { request } = event;

		const user = requireAdmin(event);
		const admin_role = user.admin_role;

		// Only SuperAdmin and OrganizationAdmin (faculty-type only) can create departments
		if (
			admin_role?.admin_level !== 'SuperAdmin' &&
			admin_role?.admin_level !== 'OrganizationAdmin'
		) {
			return fail(403, {
				error: 'คุณไม่มีสิทธิ์ในการสร้างภาควิชา'
			});
		}

		const form = await superValidate(request, zod(departmentCreateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// If OrganizationAdmin, verify their organization type is 'faculty'
		if (admin_role?.admin_level === 'OrganizationAdmin' && (admin_role as any).organization_id) {
			const rows = await db
				.select({ organizationType: organizations.organizationType })
				.from(organizations)
				.where(eq(organizations.id, (admin_role as any).organization_id))
				.limit(1);
			const orgType = rows[0]?.organizationType;
			if (orgType !== 'faculty') {
				return fail(403, { error: 'หน่วยงานประเภทนี้ไม่สามารถสร้างภาควิชาได้' });
			}
		}

		// Determine the API endpoint based on user role
		// Determine target organization
		let targetOrganizationId: string;
		if (admin_role?.admin_level === 'OrganizationAdmin' && (admin_role as any).organization_id) {
			targetOrganizationId = (admin_role as any).organization_id as string;
		} else {
			// SuperAdmin must select an organization in the form
			const selected = (form.data as any).organization_id as string | undefined;
			if (!selected) {
				return fail(400, { form, error: 'กรุณาเลือกหน่วยงาน' });
			}
			targetOrganizationId = selected;
		}

		try {
			// Verify the target organization is of type 'faculty'
			const [targetOrg] = await db
				.select({
					id: organizations.id,
					organizationType: organizations.organizationType,
					status: organizations.status
				})
				.from(organizations)
				.where(eq(organizations.id, targetOrganizationId))
				.limit(1);

			if (!targetOrg) {
				return fail(400, { form, error: 'ไม่พบหน่วยงานที่เลือก' });
			}

			if (!targetOrg.status) {
				return fail(400, { form, error: 'หน่วยงานที่เลือกไม่ได้เปิดใช้งาน' });
			}

			if (targetOrg.organizationType !== 'faculty') {
				return fail(400, { form, error: 'สามารถสร้างภาควิชาได้เฉพาะคณะเท่านั้น' });
			}

			// Insert department directly into database
			await db.insert(departments).values({
				name: form.data.name,
				code: form.data.code,
				organizationId: targetOrganizationId,
				description: form.data.description || null,
				status: form.data.status
			});

			return { form, success: true };
		} catch (error) {
			console.error('Failed to create department:', error);
			return fail(500, {
				form,
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	update: async (event) => {
		const { request } = event;

		const user = requireAdmin(event);
		const admin_role = user.admin_role;

		// Only SuperAdmin and OrganizationAdmin can update departments
		if (
			admin_role?.admin_level !== 'SuperAdmin' &&
			admin_role?.admin_level !== 'OrganizationAdmin'
		) {
			return fail(403, {
				error: 'คุณไม่มีสิทธิ์ในการแก้ไขภาควิชา'
			});
		}

		const formData = await request.formData();
		const departmentId = formData.get('departmentId') as string;
		const updateData = JSON.parse(formData.get('updateData') as string);

		const form = await superValidate(updateData, zod(departmentUpdateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Update department directly in database
			await db
				.update(departments)
				.set({
					...(form.data.name && { name: form.data.name }),
					...(form.data.code && { code: form.data.code }),
					...(form.data.description !== undefined && { description: form.data.description }),
					...(form.data.status !== undefined && { status: form.data.status }),
					updatedAt: new Date()
				})
				.where(eq(departments.id, departmentId));

			return { form, success: true };
		} catch (error) {
			console.error('Failed to update department:', error);
			return fail(500, {
				form,
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	delete: async (event) => {
		const { request } = event;

		const user = requireAdmin(event);
		const admin_role = user.admin_role;

		// Only SuperAdmin and OrganizationAdmin can delete departments
		if (
			admin_role?.admin_level !== 'SuperAdmin' &&
			admin_role?.admin_level !== 'OrganizationAdmin'
		) {
			return fail(403, {
				error: 'คุณไม่มีสิทธิ์ในการลบภาควิชา'
			});
		}

		const formData = await request.formData();
		const departmentId = formData.get('departmentId') as string;

		try {
			// Delete department directly from database
			await db.delete(departments).where(eq(departments.id, departmentId));

			return { success: true };
		} catch (error) {
			console.error('Failed to delete department:', error);
			return fail(500, {
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	toggleStatus: async (event) => {
		const { request } = event;

		const user = requireAdmin(event);
		const admin_role = user.admin_role;

		// Only SuperAdmin and OrganizationAdmin can toggle department status
		if (
			admin_role?.admin_level !== 'SuperAdmin' &&
			admin_role?.admin_level !== 'OrganizationAdmin'
		) {
			return fail(403, {
				error: 'คุณไม่มีสิทธิ์ในการเปลี่ยนสถานะภาควิชา'
			});
		}

		const formData = await request.formData();
		const departmentId = formData.get('departmentId') as string;

		try {
			// Get current status first
			const [currentDepartment] = await db
				.select({ status: departments.status })
				.from(departments)
				.where(eq(departments.id, departmentId));

			if (!currentDepartment) {
				return fail(404, { error: 'ไม่พบภาควิชาที่ต้องการ' });
			}

			// Toggle status
			await db
				.update(departments)
				.set({
					status: !currentDepartment.status,
					updatedAt: new Date()
				})
				.where(eq(departments.id, departmentId));

			return { success: true };
		} catch (error) {
			console.error('Failed to toggle department status:', error);
			return fail(500, {
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	}
};
