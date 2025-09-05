import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	return { user };
};