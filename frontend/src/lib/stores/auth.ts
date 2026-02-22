import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { auth as apiAuth, ApiError } from '$lib/api';
import type {
	SessionUser,
	LoginRequest,
	RegisterRequest,
	Permission,
	AdminLevel
} from '$lib/types';

/**
 * Authentication state interface
 * Clean JWT-based session management with httpOnly cookies
 */
interface AuthState {
	user: SessionUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	error: string | null;
	isInitialized: boolean;
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
	user: null,
	isLoading: false,
	isAuthenticated: false,
	error: null,
	isInitialized: false
};

/**
 * Create authentication store
 * Manages JWT-based authentication state with proper TypeScript types
 */
function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	// Prevent concurrent session validation requests
	let sessionValidationPromise: Promise<SessionUser | null> | null = null;
	let lastSessionCheck = 0;

	return {
		subscribe,
		set,
		update,

		/**
		 * Authenticate user with email/password
		 * Sets httpOnly JWT cookie and updates auth state
		 */
		async login(credentials: LoginRequest) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await apiAuth.login(credentials);

				// Update auth state with successful login
				update((state) => ({
					...state,
					user: response.user as any, // Type casting to match SessionUser
					isLoading: false,
					isAuthenticated: true,
					error: null,
					isInitialized: true
				}));

				return { success: true, user: response.user };
			} catch (error: any) {
				const errorMessage = error instanceof ApiError ? (error.message || 'Login failed') : 'Login failed';
				try {
					const parsed = JSON.parse(errorMessage);
					// Set detailed error if backend sends JSON
					const formattedMsg = parsed.error || parsed.message || errorMessage;
					update((state) => ({
						...state,
						user: null,
						isLoading: false,
						isAuthenticated: false,
						error: formattedMsg,
						isInitialized: true
					}));
					return { success: false, error: formattedMsg };
				} catch {
					update((state) => ({
						...state,
						user: null,
						isLoading: false,
						isAuthenticated: false,
						error: errorMessage,
						isInitialized: true
					}));
					return { success: false, error: errorMessage };
				}
			}
		},

		/**
		 * Register new user account
		 * Does not automatically log in - user must login after registration
		 */
		async register(userData: RegisterRequest) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await apiAuth.register(userData as any); // Cast as API properties match mostly

				update((state) => ({
					...state,
					isLoading: false,
					error: null
				}));

				return { success: true, user: response };
			} catch (error: any) {
				const errorMessage = error instanceof ApiError ? (error.message || 'Registration failed') : 'Registration failed';
				update((state) => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
				return { success: false, error: errorMessage };
			}
		},

		/**
		 * Log out user and clear session
		 * Clears httpOnly JWT cookie and resets auth state
		 */
		async logout(redirectTo = '/') {
			update((state) => ({ ...state, isLoading: true }));

			try {
				// Clear server-side session (httpOnly cookie)
				await apiAuth.logout().catch((err: any) => {
					console.warn('Server logout failed (continuing with client cleanup):', err);
				});
			} catch (error) {
				console.warn('Logout API call failed:', error);
			}

			// Clear local auth state
			update(() => ({
				...initialState,
				isInitialized: true
			}));

			// Reset session validation cache
			sessionValidationPromise = null;
			lastSessionCheck = 0;

			// Redirect to login page
			if (browser) {
				goto(redirectTo);
			}
		},

		/**
		 * Validate current JWT session and refresh user data
		 * Uses httpOnly cookie for security - prevents concurrent calls
		 */
		async validateSession() {
			const now = Date.now();

			// Prevent concurrent validation calls within 500ms
			if (sessionValidationPromise && now - lastSessionCheck < 500) {
				return sessionValidationPromise;
			}

			lastSessionCheck = now;
			sessionValidationPromise = (async () => {
				try {
					const response = await apiAuth.me();
					const user = response as any; // Cast down
					update((state) => ({
						...state,
						user,
						isAuthenticated: true,
						error: null,
						isInitialized: true
					}));

					return user;
				} catch (error: any) {
					// Handle session validation errors silently for better UX
					if (error instanceof ApiError) {
						if ([401, 403].includes(error.status)) {
							console.debug('[Auth] No valid session found');
							update((state) => ({
								...state,
								user: null,
								isAuthenticated: false,
								error: null,
								isInitialized: true
							}));
						} else {
							console.error('[Auth] Session validation error:', error);
							update((state) => ({
								...state,
								error: error.message,
								isInitialized: true
							}));
						}
					} else {
						console.error('[Auth] Network error during session validation:', error);
					}
				}
				return null;
			})();

			try {
				return await sessionValidationPromise;
			} finally {
				// Reset validation promise after 100ms to allow new calls
				setTimeout(() => {
					sessionValidationPromise = null;
				}, 100);
			}
		},

		/**
		 * Refresh JWT token if supported by backend
		 * Currently using simple JWT validation - extend if token refresh needed
		 */
		async refreshSession() {
			return this.validateSession();
		},

		/**
		 * Set user data directly (used by middleware/SSR)
		 */
		setUser(user: SessionUser | null) {
			update((state) => ({
				...state,
				user,
				isAuthenticated: !!user,
				isInitialized: true
			}));
		},

		/**
		 * Set authentication error
		 */
		setError(error: string | null) {
			update((state) => ({ ...state, error }));
		},

		/**
		 * Clear current error
		 */
		clearError() {
			update((state) => ({ ...state, error: null }));
		},

		/**
		 * Set loading state
		 */
		setLoading(isLoading: boolean) {
			update((state) => ({ ...state, isLoading }));
		},

		/**
		 * Mark auth as initialized (used to prevent flickering)
		 */
		setInitialized(initialized = true) {
			update((state) => ({ ...state, isInitialized: initialized }));
		}
	};
}

/**
 * Main authentication store instance
 * JWT-based authentication with httpOnly cookies
 */
export const auth = createAuthStore();

/**
 * Derived stores for easy access to auth state
 */
export const currentUser = derived(auth, ($auth) => $auth.user);
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
export const authError = derived(auth, ($auth) => $auth.error);
export const isAuthInitialized = derived(auth, ($auth) => $auth.isInitialized);

/**
 * Auth service alias for backward compatibility
 */
export const authService = auth;

/**
 * Permission and role-based derived stores
 * Clean, type-safe access to user permissions and roles
 */
export const permissions = derived(currentUser, ($user) => $user?.permissions || []);

export const adminLevel = derived(currentUser, ($user) => $user?.admin_role?.admin_level);

export const hasPermission = derived(
	permissions,
	($permissions) => (permission: Permission) => $permissions.includes(permission)
);

export const hasAnyPermission = derived(
	permissions,
	($permissions) => (requiredPermissions: Permission[]) =>
		requiredPermissions.some((p) => $permissions.includes(p))
);

export const hasAllPermissions = derived(
	permissions,
	($permissions) => (requiredPermissions: Permission[]) =>
		requiredPermissions.every((p) => $permissions.includes(p))
);

export const isAdmin = derived(currentUser, ($user) => !!$user?.admin_role);

export const isFacultyAdmin = derived(
	currentUser,
	($user) =>
		$user?.admin_role?.admin_level === 'organization_admin' ||
		$user?.admin_role?.admin_level === 'super_admin'
);

export const isSuperAdmin = derived(
	currentUser,
	($user) => $user?.admin_role?.admin_level === 'super_admin'
);

export const facultyId = derived(
	currentUser,
	($user) => $user?.organization_id || $user?.admin_role?.organization_id
);

/**
 * Initialize authentication on browser startup
 * Validates JWT session and sets up periodic session checks
 */
if (browser) {
	// Validate existing JWT session on app startup
	console.debug('[Auth] Validating JWT session...');
	auth
		.validateSession()
		.then((user) => {
			if (user) {
				console.debug('[Auth] Valid JWT session found');
			} else {
				console.debug('[Auth] No valid JWT session');
			}
		})
		.catch((error) => {
			console.debug('[Auth] Session validation failed:', error);
			auth.setInitialized(true);
		});

	// Periodic session validation (every 15 minutes)
	setInterval(
		() => {
			const currentState = { isAuthenticated: false };
			auth.subscribe((state) => Object.assign(currentState, state))();

			if (currentState.isAuthenticated) {
				auth.validateSession();
			}
		},
		15 * 60 * 1000
	);
}

/**
 * Authentication utility functions
 * Type-safe helpers for checking auth requirements
 */

/**
 * Require authenticated user - throws if not authenticated
 */
export function requireAuth(): SessionUser {
	let user: SessionUser | null = null;
	currentUser.subscribe((u) => (user = u))();

	if (!user) {
		throw new Error('Authentication required');
	}

	return user;
}

/**
 * Require specific permission - throws if not authorized
 */
export function requirePermission(permission: Permission): SessionUser {
	const user = requireAuth();

	if (!user.permissions.includes(permission)) {
		throw new Error(`Permission required: ${permission}`);
	}

	return user;
}

/**
 * Require minimum admin level - throws if insufficient privileges
 */
export function requireAdminLevel(level: AdminLevel): SessionUser {
	const user = requireAuth();

	if (!user.admin_role) {
		throw new Error('Admin access required');
	}

	const levels: AdminLevel[] = ['regular_admin', 'organization_admin', 'super_admin'];
	const userLevel = user.admin_role.admin_level;
	const requiredLevel = level;

	if (levels.indexOf(userLevel) < levels.indexOf(requiredLevel)) {
		throw new Error(`Admin level required: ${level}`);
	}

	return user;
}
