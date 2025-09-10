import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/admin/login');
	}

	// Check if user has admin role
	if (!locals.admin_role) {
		throw redirect(302, '/');
	}

	return {
		user: locals.user,
		admin_role: locals.admin_role,
		organization: locals.organization
	};
};