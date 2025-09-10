import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/admin/login');
	}

	// Check if user is admin
	if (!locals.user.is_admin) {
		throw redirect(302, '/');
	}

	return {
		user: locals.user,
		admin_role: {
			admin_level: locals.user.admin_level
		}
	};
};