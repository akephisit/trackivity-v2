/**
 * Global auth store - persists user state across the app
 * Uses CSR: reads /auth/me from Rust backend via cookie
 */
import { auth as apiAuth, type UserResponse, type LoginInput } from '$lib/api';
import { goto } from '$app/navigation';

function createAuthStore() {
    let user = $state<UserResponse | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    return {
        get user() { return user; },
        get loading() { return loading; },
        get error() { return error; },
        get isAuthenticated() { return user !== null; },
        get isAdmin() { return user?.admin_role !== null && user?.admin_role !== undefined; },

        async initialize() {
            loading = true;
            try {
                user = await apiAuth.me();
            } catch {
                user = null;
            } finally {
                loading = false;
            }
        },

        async login(credentials: LoginInput): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
            loading = true;
            error = null;
            try {
                const response = await apiAuth.login(credentials);
                user = response.user;
                return { success: true, user: response.user };
            } catch (err: any) {
                let message = 'เข้าสู่ระบบไม่สำเร็จ';
                try {
                    const parsed = JSON.parse(err.message);
                    message = parsed.error || parsed.message || message;
                } catch {
                    message = err.message || message;
                }
                error = message;
                return { success: false, error: message };
            } finally {
                loading = false;
            }
        },

        async logout() {
            try {
                await apiAuth.logout();
            } finally {
                user = null;
                error = null;
                goto('/login');
            }
        },

        setUser(u: UserResponse) {
            user = u;
        },

        clear() {
            user = null;
            error = null;
        }
    };
}

export const authStore = createAuthStore();
