// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
			details?: Record<string, any>;
		}

		/**
		 * User data available in server-side locals
		 * Set by authentication middleware in hooks.server.ts
		 */
		interface Locals {
			user: {
				id: string;
				student_id: string;
				email: string;
				first_name: string;
				last_name: string;
				is_admin: boolean;
				admin_level?: string;
				organization_id?: string;
			} | null;
		}

		/**
		 * Data passed from server to client pages
		 */
		interface PageData {
			user?: App.Locals['user'];
		}

		/**
		 * Client-side page state
		 */
		interface PageState {
			user?: App.Locals['user'];
		}
	}
}

export {};
