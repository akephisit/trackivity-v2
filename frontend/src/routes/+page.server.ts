import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import type { SessionUser } from '$lib/types';
import { getOptionalAuthUser } from '$lib/server/auth-utils';

export const load: PageServerLoad = async (event) => {
	// Try to get authenticated user (optional - won't redirect if not logged in)
	const user = getOptionalAuthUser(event);

	try {
		const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

		// Call Backend API to fetch dashboard stats/activities
		const response = await fetch(`${BACKEND_URL}/activities/dashboard`);
		if (!response.ok) {
			console.error('Failed to fetch dashboard activities:', response.status);
			return {
				user,
				activities: {
					recent: [],
					upcoming: [],
					openRegistration: [],
					popular: []
				}
			};
		}

		const data = await response.json();

		return {
			user,
			activities: {
				recent: data.recent || [],
				upcoming: data.upcoming || [],
				openRegistration: [], // Need backend support later
				popular: [] // Need backend support later
			}
		};
	} catch (error) {
		console.error('Error loading activities:', error);

		// Return user data with empty activities on error
		return {
			user,
			activities: {
				recent: [],
				upcoming: [],
				openRegistration: [],
				popular: []
			}
		};
	}
};
