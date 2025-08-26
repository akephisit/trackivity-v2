import { json, type RequestHandler } from '@sveltejs/kit';
import { db, users, adminRoles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { LoginRequest, SessionUser, Permission } from '$lib/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * User authentication endpoint
 * Validates credentials and creates JWT session
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body: LoginRequest & { student_id?: string; device_info?: any } = await request.json();
    const { email, password, student_id } = body;

    // Validate required fields
    if (!password || (!email && !student_id)) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email or Student ID and password are required',
          details: { fields: ['email', 'student_id', 'password'] }
        }
      }, { status: 400 });
    }

    // Find user by email or student_id
    const user = await db.select()
      .from(users)
      .where(email ? eq(users.email, email) : eq(users.studentId, student_id!))
      .limit(1);

    if (user.length === 0) {
      return json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials'
        }
      }, { status: 401 });
    }

    const foundUser = user[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, foundUser.passwordHash);
    if (!isValidPassword) {
      return json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials'
        }
      }, { status: 401 });
    }

    // Check if user has admin role
    const adminRole = await db.select()
      .from(adminRoles)
      .where(eq(adminRoles.userId, foundUser.id))
      .limit(1);

    // Build permissions based on admin role
    const permissions: Permission[] = [];
    const isAdmin = adminRole.length > 0;
    const adminLevel = isAdmin ? adminRole[0].adminLevel : null;
    
    // Convert snake_case DB values to PascalCase for TypeScript
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

    // Create JWT payload
    const payload = {
      user_id: foundUser.id,
      student_id: foundUser.studentId,
      email: foundUser.email,
      first_name: foundUser.firstName,
      last_name: foundUser.lastName,
      department_id: foundUser.departmentId,
      is_admin: isAdmin,
      admin_level: convertedAdminLevel,
      faculty_id: isAdmin ? adminRole[0].facultyId : null
    };

    // Generate JWT with expiration
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Set secure HTTP-only cookie
    cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/'
    });

    // Build SessionUser response matching the /me endpoint format
    const sessionUser: SessionUser = {
      user_id: foundUser.id,
      student_id: foundUser.studentId,
      email: foundUser.email,
      first_name: foundUser.firstName,
      last_name: foundUser.lastName,
      department_id: foundUser.departmentId || undefined,
      faculty_id: (isAdmin ? adminRole[0].facultyId : null) || undefined,
      session_id: token.slice(0, 16), // Use first 16 chars as session ID
      permissions,
      expires_at: expiresAt.toISOString(),
      created_at: foundUser.createdAt?.toISOString(),
      updated_at: foundUser.updatedAt?.toISOString(),
      admin_role: isAdmin ? {
        id: adminRole[0].id,
        admin_level: convertedAdminLevel as any,
        faculty_id: adminRole[0].facultyId || undefined,
        permissions,
        created_at: adminRole[0].createdAt?.toISOString() || new Date().toISOString(),
        updated_at: adminRole[0].updatedAt?.toISOString() || new Date().toISOString()
      } : undefined
    };

    return json({
      success: true,
      data: {
        user: sessionUser
      }
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during login',
        details: process.env.NODE_ENV === 'development' ? { error: error instanceof Error ? error.message : 'Unknown error' } : undefined
      }
    }, { status: 500 });
  }
};