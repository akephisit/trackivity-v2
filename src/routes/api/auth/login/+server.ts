import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, adminRoles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password, student_id, device_info } = await request.json();

    // Validate required fields
    if (!password || (!email && !student_id)) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email/Student ID and password are required'
        }
      }, { status: 400 });
    }

    // Find user by email or student_id
    const user = await db.select()
      .from(users)
      .where(email ? eq(users.email, email) : eq(users.studentId, student_id))
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

    // Create JWT payload
    const payload = {
      user_id: foundUser.id,
      student_id: foundUser.studentId,
      email: foundUser.email,
      first_name: foundUser.firstName,
      last_name: foundUser.lastName,
      department_id: foundUser.departmentId,
      is_admin: adminRole.length > 0,
      admin_level: adminRole.length > 0 ? adminRole[0].adminLevel : null,
      faculty_id: adminRole.length > 0 ? adminRole[0].facultyId : null
    };

    // Generate JWT
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set HTTP-only cookie
    cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/'
    });

    return json({
      success: true,
      data: {
        user: {
          id: foundUser.id,
          student_id: foundUser.studentId,
          email: foundUser.email,
          first_name: foundUser.firstName,
          last_name: foundUser.lastName,
          department_id: foundUser.departmentId,
          created_at: foundUser.createdAt,
          updated_at: foundUser.updatedAt
        },
        token, // Optional: return token for client-side storage if needed
        expires_in: JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
};