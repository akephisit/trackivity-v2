import { db, users, adminRoles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { SessionUser, Permission } from '$lib/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

export interface AuthInput {
  email?: string;
  student_id?: string;
  password: string;
  remember_me?: boolean;
}

export interface AuthResult {
  user: SessionUser;
  token: string;
  expiresAt: Date;
}

export async function authenticateAndIssueToken(input: AuthInput): Promise<AuthResult> {
  const { email, student_id, password, remember_me } = input;

  if (!password || (!email && !student_id)) {
    const err: any = new Error('Email or Student ID and password are required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const userRes = await db.select()
    .from(users)
    .where(email ? eq(users.email, email) : eq(users.studentId, student_id!))
    .limit(1);

  if (userRes.length === 0) {
    const err: any = new Error('Invalid credentials');
    err.code = 'AUTH_ERROR';
    throw err;
  }

  const foundUser = userRes[0];

  // Enforce password-based login only (no passwordless)
  // Guard against disabled/blank hashes (treat as password login disabled)
  if (!foundUser.passwordHash || foundUser.passwordHash.trim() === '' || foundUser.passwordHash === 'DISABLED') {
    const err: any = new Error('Password login disabled for this account');
    err.code = 'PASSWORD_DISABLED';
    throw err;
  }

  const isValidPassword = await bcrypt.compare(password, foundUser.passwordHash);
  if (!isValidPassword) {
    const err: any = new Error('Invalid credentials');
    err.code = 'AUTH_ERROR';
    throw err;
  }

  const adminRoleRes = await db.select()
    .from(adminRoles)
    .where(eq(adminRoles.userId, foundUser.id))
    .limit(1);

  const permissions: Permission[] = [];
  const isAdmin = adminRoleRes.length > 0;
  const adminLevel = isAdmin ? adminRoleRes[0].adminLevel : null;

  const convertAdminLevel = (dbLevel: string | null): string | null => {
    if (!dbLevel) return null;
    switch (dbLevel) {
      case 'super_admin': return 'SuperAdmin';
      case 'faculty_admin': return 'FacultyAdmin';
      case 'regular_admin': return 'RegularAdmin';
      default: return 'RegularAdmin';
    }
  };

  const convertedAdminLevel = convertAdminLevel(adminLevel);

  if (isAdmin) {
    if (adminLevel === 'super_admin') {
      permissions.push(
        'ViewAllUsers', 'CreateUsers', 'UpdateUsers', 'DeleteUsers',
        'ViewAllFaculties', 'CreateFaculties', 'UpdateFaculties', 'DeleteFaculties',
        'ViewAllSessions', 'ManageAllSessions', 'ViewSystemAnalytics'
      );
    } else if (adminLevel === 'faculty_admin') {
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

  const payload = {
    user_id: foundUser.id,
    student_id: foundUser.studentId,
    email: foundUser.email,
    first_name: foundUser.firstName,
    last_name: foundUser.lastName,
    department_id: foundUser.departmentId,
    is_admin: isAdmin,
    admin_level: convertedAdminLevel,
    faculty_id: isAdmin ? adminRoleRes[0].facultyId : null
  };

  // Expiration: 30 days if remember_me, otherwise default 7 days
  const expiresInSeconds = (remember_me ? 30 : 7) * 24 * 60 * 60;
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  const sessionUser: SessionUser = {
    user_id: foundUser.id,
    student_id: foundUser.studentId,
    email: foundUser.email,
    first_name: foundUser.firstName,
    last_name: foundUser.lastName,
    department_id: foundUser.departmentId || undefined,
    faculty_id: (isAdmin ? adminRoleRes[0].facultyId : null) || undefined,
    session_id: token.slice(0, 16),
    permissions,
    expires_at: expiresAt.toISOString(),
    created_at: foundUser.createdAt?.toISOString(),
    updated_at: foundUser.updatedAt?.toISOString(),
    admin_role: isAdmin ? {
      id: adminRoleRes[0].id,
      admin_level: convertedAdminLevel as any,
      faculty_id: adminRoleRes[0].facultyId || undefined,
      permissions,
      created_at: adminRoleRes[0].createdAt?.toISOString() || new Date().toISOString(),
      updated_at: adminRoleRes[0].updatedAt?.toISOString() || new Date().toISOString()
    } : undefined
  };

  return { user: sessionUser, token, expiresAt };
}
