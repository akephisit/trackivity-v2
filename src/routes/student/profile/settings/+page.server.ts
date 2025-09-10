import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// For student routes, we assume if they can access /student/** they are students
	// The authentication is handled by the parent layout

	return {
		user: locals.user
	};
};