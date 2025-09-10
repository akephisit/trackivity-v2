import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check if user is a student
	if (locals.user.user_role !== 'Student') {
		throw redirect(302, '/');
	}

	return {
		user: locals.user
	};
};