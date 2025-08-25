import { json } from '@sveltejs/kit';
import { db, users, departments, faculties } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export const GET = async ({ params, cookies }: { params: any; cookies: any }) => {
  try {
    const token = cookies.get('session_token');
    if (!token) {
      return json({
        success: false,
        error: { code: 'NO_SESSION', message: 'Authentication required' }
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return json({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Invalid session' }
      }, { status: 401 });
    }

    const userId = params.id;

    // Get user with department and faculty info
    const user = await db.select({
      id: users.id,
      studentId: users.studentId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      departmentId: users.departmentId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      department: {
        id: departments.id,
        name: departments.name,
        code: departments.code,
        facultyId: departments.facultyId
      },
      faculty: {
        id: faculties.id,
        name: faculties.name,
        code: faculties.code
      }
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(eq(users.id, userId))
    .limit(1);

    if (user.length === 0) {
      return json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      }, { status: 404 });
    }

    return json({
      success: true,
      data: user[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    return json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
};

export const PUT = async ({ params, request, cookies }: { params: any; request: any; cookies: any }) => {
  try {
    const token = cookies.get('session_token');
    if (!token) {
      return json({
        success: false,
        error: { code: 'NO_SESSION', message: 'Authentication required' }
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.is_admin) {
      return json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin access required' }
      }, { status: 403 });
    }

    const userId = params.id;
    const userData = await request.json();

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    if (userData.student_id) updateData.studentId = userData.student_id;
    if (userData.email) updateData.email = userData.email;
    if (userData.first_name) updateData.firstName = userData.first_name;
    if (userData.last_name) updateData.lastName = userData.last_name;
    if (userData.department_id !== undefined) updateData.departmentId = userData.department_id;

    // Hash password if provided
    if (userData.password) {
      updateData.passwordHash = await bcrypt.hash(userData.password, 10);
    }

    // Update user
    const updatedUser = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        studentId: users.studentId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        departmentId: users.departmentId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      });

    return json({
      success: true,
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    return json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
};

export const DELETE = async ({ params, cookies }: { params: any; cookies: any }) => {
  try {
    const token = cookies.get('session_token');
    if (!token) {
      return json({
        success: false,
        error: { code: 'NO_SESSION', message: 'Authentication required' }
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.is_admin) {
      return json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin access required' }
      }, { status: 403 });
    }

    const userId = params.id;

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      }, { status: 404 });
    }

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    return json({
      success: true,
      data: { message: 'User deleted successfully' }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
};