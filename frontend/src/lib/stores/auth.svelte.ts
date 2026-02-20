/**
 * Global auth store - persists user state across the app
 * Uses CSR: reads /auth/me from Rust backend via cookie
 */
import { auth, type UserResponse } from '$lib/api';
import { goto } from '$app/navigation';

function createAuthStore() {
    let user = $state<UserResponse | null>(null);
    let loading = $state(true);

    return {
        get user() { return user; },
        get loading() { return loading; },
        get isAuthenticated() { return user !== null; },
        get isAdmin() { return user?.admin_role !== null && user?.admin_role !== undefined; },

        async initialize() {
            try {
                user = await auth.me();
            } catch {
                user = null;
            } finally {
                loading = false;
            }
        },

        async logout() {
            try {
                await auth.logout();
            } finally {
                user = null;
                goto('/login');
            }
        },

        setUser(u: UserResponse) {
            user = u;
        },

        clear() {
            user = null;
        }
    };
}

export const authStore = createAuthStore();
