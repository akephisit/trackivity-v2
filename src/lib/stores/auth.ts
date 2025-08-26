import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { apiClient, isApiSuccess, handleApiError, isApiError } from '$lib/api/client';
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
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const response = await apiClient.login(credentials);
        
        if (isApiSuccess(response)) {
          const { user } = response.data;

          // Update auth state with successful login
          update(state => ({
            ...state,
            user,
            isLoading: false,
            isAuthenticated: true,
            error: null,
            isInitialized: true
          }));

          return { success: true, user };
        }
      } catch (error) {
        const errorMessage = handleApiError(error);
        update(state => ({
          ...state,
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: errorMessage,
          isInitialized: true
        }));
        return { success: false, error: errorMessage };
      }

      return { success: false, error: 'Login failed' };
    },

    /**
     * Register new user account
     * Does not automatically log in - user must login after registration
     */
    async register(userData: RegisterRequest) {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const response = await apiClient.register(userData);
        
        if (isApiSuccess(response)) {
          update(state => ({
            ...state,
            isLoading: false,
            error: null
          }));

          return { success: true, user: response.data };
        }
      } catch (error) {
        const errorMessage = handleApiError(error);
        update(state => ({
          ...state,
          isLoading: false,
          error: errorMessage
        }));
        return { success: false, error: errorMessage };
      }

      return { success: false, error: 'Registration failed' };
    },

    /**
     * Log out user and clear session
     * Clears httpOnly JWT cookie and resets auth state
     */
    async logout(redirectTo = '/login') {
      update(state => ({ ...state, isLoading: true }));

      try {
        // Clear server-side session (httpOnly cookie)
        await apiClient.logout().catch((err) => {
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
          const response = await apiClient.me();
          if (isApiSuccess(response)) {
            const user = response.data;
            update(state => ({
              ...state,
              user,
              isAuthenticated: true,
              error: null,
              isInitialized: true
            }));

            return user;
          }
        } catch (error) {
          // Handle session validation errors
          if (isApiError(error)) {
            const code = error.code;
            if (['SESSION_EXPIRED', 'SESSION_INVALID', 'NO_SESSION', 'AUTH_ERROR'].includes(code)) {
              console.debug('[Auth] No valid session found');
              update(state => ({
                ...state,
                user: null,
                isAuthenticated: false,
                error: null,
                isInitialized: true
              }));
            } else {
              console.error('[Auth] Session validation error:', error);
              update(state => ({
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
        setTimeout(() => { sessionValidationPromise = null; }, 100);
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
      update(state => ({
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
      update(state => ({ ...state, error }));
    },

    /**
     * Clear current error
     */
    clearError() {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Set loading state
     */
    setLoading(isLoading: boolean) {
      update(state => ({ ...state, isLoading }));
    },

    /**
     * Mark auth as initialized (used to prevent flickering)
     */
    setInitialized(initialized = true) {
      update(state => ({ ...state, isInitialized: initialized }));
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
export const currentUser = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => $auth.isAuthenticated);
export const isLoading = derived(auth, $auth => $auth.isLoading);
export const authError = derived(auth, $auth => $auth.error);
export const isAuthInitialized = derived(auth, $auth => $auth.isInitialized);

/**
 * Auth service alias for backward compatibility
 */
export const authService = auth;

/**
 * Permission and role-based derived stores
 * Clean, type-safe access to user permissions and roles
 */
export const permissions = derived(currentUser, $user => $user?.permissions || []);

export const adminLevel = derived(currentUser, $user => $user?.admin_role?.admin_level);

export const hasPermission = derived(
  permissions, 
  $permissions => (permission: Permission) => $permissions.includes(permission)
);

export const hasAnyPermission = derived(
  permissions,
  $permissions => (requiredPermissions: Permission[]) => 
    requiredPermissions.some(p => $permissions.includes(p))
);

export const hasAllPermissions = derived(
  permissions,
  $permissions => (requiredPermissions: Permission[]) =>
    requiredPermissions.every(p => $permissions.includes(p))
);

export const isAdmin = derived(
  currentUser,
  $user => !!$user?.admin_role
);

export const isFacultyAdmin = derived(
  currentUser,
  $user => $user?.admin_role?.admin_level === 'FacultyAdmin' || 
           $user?.admin_role?.admin_level === 'SuperAdmin'
);

export const isSuperAdmin = derived(
  currentUser,
  $user => $user?.admin_role?.admin_level === 'SuperAdmin'
);

export const facultyId = derived(
  currentUser,
  $user => $user?.faculty_id || $user?.admin_role?.faculty_id
);

/**
 * Initialize authentication on browser startup
 * Validates JWT session and sets up periodic session checks
 */
if (browser) {
  // Validate existing JWT session on app startup
  console.log('[Auth] Validating JWT session...');
  auth.validateSession().then(user => {
    if (user) {
      console.log('[Auth] Valid JWT session found');
    } else {
      console.log('[Auth] No valid JWT session');
    }
  }).catch(error => {
    console.warn('[Auth] Session validation failed:', error);
    auth.setInitialized(true);
  });

  // Periodic session validation (every 15 minutes)
  setInterval(() => {
    const currentState = { isAuthenticated: false };
    auth.subscribe(state => Object.assign(currentState, state))();
    
    if (currentState.isAuthenticated) {
      auth.validateSession();
    }
  }, 15 * 60 * 1000);
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
  currentUser.subscribe(u => user = u)();
  
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
  
  const levels: AdminLevel[] = ['RegularAdmin', 'FacultyAdmin', 'SuperAdmin'];
  const userLevel = user.admin_role.admin_level;
  const requiredLevel = level;
  
  if (levels.indexOf(userLevel) < levels.indexOf(requiredLevel)) {
    throw new Error(`Admin level required: ${level}`);
  }
  
  return user;
}