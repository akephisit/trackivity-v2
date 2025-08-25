import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const GET = async ({ cookies }: { cookies: any }) => {
  try {
    const token = cookies.get('session_token');

    if (!token) {
      return json({
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'No active session'
        }
      }, { status: 401 });
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      return json({
        success: true,
        data: {
          user: {
            id: decoded.user_id,
            student_id: decoded.student_id,
            email: decoded.email,
            first_name: decoded.first_name,
            last_name: decoded.last_name,
            department_id: decoded.department_id
          },
          is_admin: decoded.is_admin || false,
          admin_level: decoded.admin_level || null,
          faculty_id: decoded.faculty_id || null
        }
      });

    } catch (jwtError) {
      return json({
        success: false,
        error: {
          code: 'SESSION_INVALID',
          message: 'Invalid session'
        }
      }, { status: 401 });
    }

  } catch (error) {
    console.error('Me endpoint error:', error);
    return json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
};