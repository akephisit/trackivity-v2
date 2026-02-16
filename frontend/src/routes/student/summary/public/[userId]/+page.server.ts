import type { PageServerLoad } from './$types';
import { getStudentSummaryByUserId } from '$lib/server/student-summary';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { userId } = params;
	if (!userId) {
		throw error(400, 'Missing user identifier');
	}

	const summary = await getStudentSummaryByUserId(userId);
	if (!summary.userInfo) {
		throw error(404, 'ไม่พบข้อมูลนักศึกษา');
	}

	return {
		summary
	};
};
