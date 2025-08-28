import { redirect, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, faculties } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';

// Faculty schemas
const facultyCreateSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหน่วยงาน'),
  code: z.string().min(1, 'กรุณากรอกรหัสหน่วยงาน').max(10, 'รหัสหน่วยงานต้องไม่เกิน 10 ตัวอักษร'),
	description: z.string().optional(),
	status: z.boolean().default(true)
});

const facultyUpdateSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหน่วยงาน').optional(),
  code: z.string().min(1, 'กรุณากรอกรหัสหน่วยงาน').max(10, 'รหัสหน่วยงานต้องไม่เกิน 10 ตัวอักษร').optional(),
	description: z.string().optional(),
	status: z.boolean().optional()
});

export const load: PageServerLoad = async (event) => {
	const { cookies, depends } = event;
	depends('app:page-data');
	
	// Ensure user is authenticated as admin
	const user = requireAdmin(event);

	try {
		// Fetch all faculties directly from database
		const facultiesData = await db
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
			.orderBy(desc(faculties.createdAt));

		// Create forms
		const createForm = await superValidate(zod(facultyCreateSchema));
		const updateForm = await superValidate(zod(facultyUpdateSchema));

		return {
			faculties: facultiesData,
			createForm,
			updateForm,
			user
		};
	} catch (error) {
		console.error('Failed to load faculties data:', error);
		return {
			faculties: [],
			createForm: await superValidate(zod(facultyCreateSchema)),
			updateForm: await superValidate(zod(facultyUpdateSchema)),
			user
		};
	}
};

export const actions: Actions = {
	create: async (event) => {
		const { request } = event;
		// Ensure user is authenticated as admin
		requireAdmin(event);

		const form = await superValidate(request, zod(facultyCreateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Insert directly into database
            await db.insert(faculties).values({
                name: form.data.name,
                code: form.data.code,
                description: form.data.description || null,
                status: form.data.status ?? true
            });

			return { form, success: true };
		} catch (error) {
			console.error('Failed to create faculty:', error);
			return fail(500, { 
				form,
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	update: async (event) => {
		const { request } = event;
		// Ensure user is authenticated as admin
		requireAdmin(event);

		const formData = await request.formData();
		const facultyId = formData.get('facultyId') as string;
		const updateData = JSON.parse(formData.get('updateData') as string);

		const form = await superValidate(updateData, zod(facultyUpdateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			// Update directly in database
			await db.update(faculties)
				.set({
					...(form.data.name && { name: form.data.name }),
					...(form.data.code && { code: form.data.code }),
					...(form.data.description !== undefined && { description: form.data.description }),
					...(form.data.status !== undefined && { status: form.data.status }),
					updatedAt: new Date()
				})
				.where(eq(faculties.id, facultyId));

			return { form, success: true };
		} catch (error) {
			console.error('Failed to update faculty:', error);
			return fail(500, { 
				form,
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	delete: async (event) => {
		const { request } = event;
		// Ensure user is authenticated as admin
		requireAdmin(event);

		const formData = await request.formData();
		const facultyId = formData.get('facultyId') as string;

		try {
			// Delete directly from database
			await db.delete(faculties).where(eq(faculties.id, facultyId));

			return { success: true };
		} catch (error) {
			console.error('Failed to delete faculty:', error);
			return fail(500, { 
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	},

	toggleStatus: async (event) => {
		const { request } = event;
		// Ensure user is authenticated as admin
		requireAdmin(event);

		const formData = await request.formData();
		const facultyId = formData.get('facultyId') as string;

		try {
			// Get current status first
			const [currentFaculty] = await db
				.select({ status: faculties.status })
				.from(faculties)
				.where(eq(faculties.id, facultyId));

			if (!currentFaculty) {
          return fail(404, { error: 'ไม่พบหน่วยงานที่ต้องการ' });
			}

			// Toggle status
			await db.update(faculties)
				.set({ 
					status: !currentFaculty.status,
					updatedAt: new Date()
				})
				.where(eq(faculties.id, facultyId));

			return { success: true };
		} catch (error) {
			console.error('Failed to toggle faculty status:', error);
			return fail(500, { 
				error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
			});
		}
	}
};
