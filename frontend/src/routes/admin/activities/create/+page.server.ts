import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';
import { env } from '$env/dynamic/private';

// Validation schema for activity creation (Simplified for Rust Backend compatibility)
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
	// These fields are not yet supported by simple create API, maybe later
	// eligible_organizations: z.string(),
	// academic_year: z.string(),
	// activity_level: z.enum(['faculty', 'university'])
});

export const load: PageServerLoad = async (event) => {
	// ตรวจสอบสิทธิ์ - เฉพาะ OrganizationAdmin หรือ SuperAdmin
	const user = requireOrganizationAdmin(event);

	const form = await superValidate(zod(activityCreateSchema));

	// Mock Organizations for now
	const organizations = {
		all: [
			{ id: user.organization_id || '00000000-0000-0000-0000-000000000000', name: 'My Faculty', organization_type: 'faculty' }
		],
		grouped: { faculty: [], office: [] }
	};

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

			// Construct payload for Rust Backend
			const activityData = {
				title: form.data.title,
				description: form.data.description,
				start_date: form.data.start_date,
				end_date: form.data.end_date,
				// Time must be HH:MM:SS format for NaiveTime in Rust (sometimes)
				start_time_only: form.data.start_time + ":00",
				end_time_only: form.data.end_time + ":00",
				activity_type: form.data.activity_type,
				location: form.data.location,
				max_participants: form.data.max_participants ? parseInt(form.data.max_participants) : null,
				hours: form.data.hours ? parseInt(form.data.hours) : 1,
				organizer_id: form.data.organizer_id,
				// academic_year: 2024 is handled by backend default for now
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
