import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import { env } from '$env/dynamic/private';

// Validation schema
const activityCreateSchema = z.object({
	title: z.string().min(1, 'กรุณากรอกชื่อกิจกรรม').max(255),
	description: z.string().optional().or(z.literal('')),
	start_date: z.string().min(1, 'กรุณาเลือกวันที่เริ่ม'),
	end_date: z.string().min(1, 'กรุณาเลือกวันที่สิ้นสุด'),
	start_time: z.string().min(1, 'กรุณากรอกเวลาเริ่ม'),
	end_time: z.string().min(1, 'กรุณากรอกเวลาสิ้นสุด'),
	activity_type: z.enum(['Academic', 'Sports', 'Cultural', 'Social', 'Other']),
	location: z.string().min(1, 'กรุณากรอกสถานที่'),
	max_participants: z.string().optional(),
	hours: z.string().min(1, 'กรุณากรอกจำนวนชั่วโมง').regex(/^\d+$/),
	organizer_id: z.string().min(1, 'กรุณาเลือกหน่วยงาน'),
});

export const load: PageServerLoad = async (event) => {
	// ตรวจสอบสิทธิ์
	const user = requireOrganizationAdmin(event);

	const form = await superValidate(zod(activityCreateSchema));

	// Fetch real organizations
	let organizations: any = { all: [], grouped: { faculty: [], office: [] } };
	try {
		const BACKEND_URL = env.BACKEND_URL || 'http://localhost:3000';
		const response = await fetch(`${BACKEND_URL}/organizations`);
		if (response.ok) {
			organizations = await response.json();

			// Backend returns snake_case enums ('faculty', 'office') in Rust, 
			// but Frontend might expect exact string match. Let's make sure our usage matches.
			// If backend serialization uses rename_all="snake_case", it should match 'faculty'/'office'.

			// Note: If Organizations list is empty, we should handle it gracefully in UI
		} else {
			console.error('Failed to fetch organizations:', response.status);
			// Fallback to user's organization if available
			if (user.organization_id) {
				organizations.all = [{ id: user.organization_id, name: 'Current Organization', organization_type: 'faculty' }];
			}
		}
	} catch (e) {
		console.error('Error fetching organizations:', e);
	}

	return {
		form,
		user,
		admin_role: user.admin_role,
		organizations
	};
};

export const actions: Actions = {
	default: async (event) => {
		requireOrganizationAdmin(event);

		const form = await superValidate(event, zod(activityCreateSchema));
		if (!form.valid) {
			return fail(400, { form, error: 'ข้อมูลไม่ถูกต้อง' });
		}

		try {
			const BACKEND_URL = env.BACKEND_URL || 'http://localhost:3000';
			const sessionToken = event.cookies.get('session_token');

			const activityData = {
				title: form.data.title,
				description: form.data.description,
				start_date: form.data.start_date,
				end_date: form.data.end_date,
				start_time_only: form.data.start_time + ":00",
				end_time_only: form.data.end_time + ":00",
				activity_type: form.data.activity_type,
				location: form.data.location,
				max_participants: form.data.max_participants ? parseInt(form.data.max_participants) : null,
				hours: form.data.hours ? parseInt(form.data.hours) : 1,
				organizer_id: form.data.organizer_id,
			};

			const response = await fetch(`${BACKEND_URL}/activities`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify(activityData)
			});

			if (!response.ok) {
				const errorText = await response.text();
				return fail(response.status, { form, error: `Backend Error: ${errorText}` });
			}

			return { form, success: true };
		} catch (error) {
			console.error('Error creating activity:', error);
			return fail(500, { form, error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
		}
	}
};
