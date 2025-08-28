import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireOrganizationAdmin } from '$lib/server/auth-utils';
import { db, activities } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

function computeStatus(
	now: Date,
	startDate: Date,
	endDate: Date
): 'draft' | 'published' | 'ongoing' | 'completed' {
	if (now < startDate) return 'published';
	if (now >= startDate && now <= endDate) return 'ongoing';
	return 'completed';
}

export const POST: RequestHandler = async (event) => {
	const user = await requireOrganizationAdmin(event);
	try {
		// Load activities scoped by organization for OrganizationAdmin; all for SuperAdmin
		const where =
			user.admin_role?.admin_level === 'OrganizationAdmin' && user.admin_role?.organization_id
				? eq(activities.organizationId, user.admin_role.organization_id)
				: (undefined as any);

		const rows = await db
			.select({
				id: activities.id,
				start_date: activities.startDate,
				end_date: activities.endDate,
				status: activities.status
			})
			.from(activities)
			.where(where)
			.$dynamic();

		const now = new Date();
		let updated = 0;
		for (const a of rows) {
			if (!a.start_date || !a.end_date) continue;
			if (a.status === 'cancelled' || a.status === 'draft') continue;
			const newStatus = computeStatus(
				now,
				new Date(a.start_date as any),
				new Date(a.end_date as any)
			);
			if (newStatus !== a.status) {
				await db
					.update(activities)
					.set({ status: newStatus, updatedAt: new Date() })
					.where(eq(activities.id, a.id));
				updated++;
			}
		}

		return json({ status: 'success', updated });
	} catch (e) {
		console.error('Update statuses error:', e);
		return json({ status: 'error', message: 'ไม่สามารถอัพเดตสถานะกิจกรรมได้' }, { status: 500 });
	}
};
