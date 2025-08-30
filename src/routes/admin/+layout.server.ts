import { requireAdmin } from '$lib/server/auth-utils';
import { db, organizations } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	// Skip authentication for admin login page
	if (event.url.pathname === '/admin/login') {
		return {};
	}

	// ตรวจสอบว่าผู้ใช้เป็นแอดมิน
	const user = requireAdmin(event);

	// หากเป็น OrganizationAdmin ให้ดึงประเภทหน่วยงานแนบไปด้วย
	let organization: { id: string; name: string; organizationType: 'faculty' | 'office' } | undefined;
	try {
		const role = user.admin_role as any;
		if (role?.admin_level === 'OrganizationAdmin' && role?.organization_id) {
			const rows = await db
				.select({
					id: organizations.id,
					name: organizations.name,
					organizationType: organizations.organizationType
				})
				.from(organizations)
				.where(eq(organizations.id, role.organization_id))
				.limit(1);
			if (rows.length > 0) {
				organization = rows[0] as any;
			}
		}
	} catch (e) {
		// ignore and continue without organization context
	}

	return {
		user,
		admin_role: user.admin_role,
		organization
	};
};
