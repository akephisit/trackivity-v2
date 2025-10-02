import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { getStudentSummary } from '$lib/server/student-summary';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	event.depends('student:summary');

	return await getStudentSummary(user);
};
