// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
			details?: Record<string, any>;
		}
		
		interface Locals {
			user: {
				id: string;
				student_id: string;
				email: string;
				first_name: string;
				last_name: string;
				is_admin: boolean;
				admin_level?: string;
				faculty_id?: string;
			} | null;
		}
		
		interface PageData {
			user?: App.Locals['user'];
		}
		
		interface PageState {
			user?: App.Locals['user'];
		}
		// interface Platform {}
	}
}

export {};
