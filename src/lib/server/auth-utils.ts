import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import type { RequestEvent } from '@sveltejs/kit';
import type { SessionUser, AdminLevel, Permission } from '$lib/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * JWT payload interface for server-side validation
 */
export interface JWTPayload {
  user_id: string;
  student_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id?: string;
  is_admin: boolean;
  admin_level?: string;
  faculty_id?: string;
  iat?: number;
  exp?: number;
}

/**
 * Validate JWT token on server-side
 */
export function validateJWTToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Get authenticated user from request event
 * Uses locals.user set by the middleware
 */
export function getAuthenticatedUser(event: RequestEvent): SessionUser | null {
  if (!event.locals.user) {
    return null;
  }

  const user = event.locals.user;
  const permissions: Permission[] = [];
  
  // Build permissions based on admin status
  if (user.is_admin) {
    if (user.admin_level === 'SuperAdmin') {
      permissions.push(
        'ViewAllUsers', 'CreateUsers', 'UpdateUsers', 'DeleteUsers',
        'ViewAllFaculties', 'CreateFaculties', 'UpdateFaculties', 'DeleteFaculties',
        'ViewAllSessions', 'ManageAllSessions', 'ViewSystemAnalytics'
      );
    } else if (user.admin_level === 'FacultyAdmin') {
      permissions.push(
        'ViewFacultyUsers', 'CreateFacultyUsers', 'UpdateFacultyUsers',
        'ViewFacultyAnalytics', 'ManageFacultyActivities',
        'ViewFacultySessions', 'ManageFacultySessions'
      );
    } else {
      permissions.push(
        'ViewAssignedActivities', 'ScanQRCodes', 'ViewPersonalSessions'
      );
    }
  } else {
    permissions.push('ViewPersonalQR', 'ViewPersonalHistory');
  }

  return {
    user_id: user.id,
    student_id: user.student_id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    department_id: undefined, // Will be populated by server if needed
    faculty_id: user.faculty_id,
    session_id: `session_${user.id}`,
    permissions,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    admin_role: user.is_admin ? {
      id: `admin_${user.id}`,
      admin_level: (user.admin_level as AdminLevel) || 'RegularAdmin',
      faculty_id: user.faculty_id,
      permissions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } : undefined
  };
}

/**
 * Require authenticated user - throws redirect if not authenticated
 */
export function requireAuth(event: RequestEvent): SessionUser {
  const user = getAuthenticatedUser(event);
  
  if (!user) {
    const returnUrl = encodeURIComponent(event.url.pathname + event.url.search);
    throw redirect(303, `/login?redirectTo=${returnUrl}`);
  }
  
  return user;
}

/**
 * Require admin user - throws redirect if not admin
 */
export function requireAdmin(event: RequestEvent): SessionUser {
  const user = requireAuth(event);
  
  if (!user.admin_role) {
    const returnUrl = encodeURIComponent(event.url.pathname + event.url.search);
    throw redirect(303, `/admin/login?redirectTo=${returnUrl}`);
  }
  
  return user;
}

/**
 * Require specific admin level - throws redirect if insufficient privileges
 */
export function requireAdminLevel(
  event: RequestEvent, 
  requiredLevel: AdminLevel
): SessionUser {
  const user = requireAdmin(event);
  
  if (!hasAdminLevel(user.admin_role!.admin_level, requiredLevel)) {
    throw redirect(303, '/unauthorized');
  }

  return user;
}

/**
 * Require specific permission - throws redirect if not authorized
 */
export function requirePermission(
  event: RequestEvent, 
  permission: Permission
): SessionUser {
  const user = requireAuth(event);
  
  if (!user.permissions.includes(permission)) {
    throw redirect(303, '/unauthorized');
  }

  return user;
}

/**
 * Check if user has required admin level
 */
export function hasAdminLevel(userLevel: AdminLevel, requiredLevel: AdminLevel): boolean {
  const hierarchy = {
    'SuperAdmin': 3,
    'FacultyAdmin': 2,
    'RegularAdmin': 1
  };
  
  return hierarchy[userLevel] >= hierarchy[requiredLevel];
}

/**
 * Require SuperAdmin access
 */
export function requireSuperAdmin(event: RequestEvent): SessionUser {
  return requireAdminLevel(event, 'SuperAdmin');
}

/**
 * Require FacultyAdmin or SuperAdmin access
 */
export function requireFacultyAdmin(event: RequestEvent): SessionUser {
  const user = requireAdmin(event);
  
  const level = user.admin_role!.admin_level;
  if (level !== 'SuperAdmin' && level !== 'FacultyAdmin') {
    throw redirect(303, '/unauthorized');
  }

  return user;
}

/**
 * Require access to specific faculty
 */
export function requireFacultyAccess(
  event: RequestEvent,
  facultyId: string
): SessionUser {
  const user = requireAdmin(event);
  
  const level = user.admin_role!.admin_level;
  
  // SuperAdmin can access all faculties
  if (level === 'SuperAdmin') {
    return user;
  }
  
  // FacultyAdmin can only access their own faculty
  if (level === 'FacultyAdmin' && user.admin_role!.faculty_id === facultyId) {
    return user;
  }
  
  throw redirect(303, '/unauthorized');
}

/**
 * Get optional authenticated user (doesn't throw if not authenticated)
 */
export function getOptionalAuthUser(event: RequestEvent): SessionUser | null {
  try {
    return getAuthenticatedUser(event);
  } catch {
    return null;
  }
}