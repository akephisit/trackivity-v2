import { json } from '@sveltejs/kit';
import { db, faculties } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export const GET = async ({ cookies }: { cookies: any }) => {
  try {
    // Get all active faculties (no auth required for basic list)
    const facultiesList = await db.select({
      id: faculties.id,
      name: faculties.name,
      code: faculties.code,
      description: faculties.description,
      status: faculties.status,
      createdAt: faculties.createdAt,
      updatedAt: faculties.updatedAt
    })
    .from(faculties)
    .where(eq(faculties.status, true))
    .orderBy(faculties.name);

    return json({
      success: true,
      data: facultiesList
    });

  } catch (error) {
    console.error('Get faculties error:', error);
    return json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
};

export const POST = async ({ request, cookies }: { request: any; cookies: any }) => {
  try {
    const token = cookies.get('session_token');
    if (!token) {
      return json({
        success: false,
        error: { code: 'NO_SESSION', message: 'Authentication required' }
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.is_admin || decoded.admin_level !== 'super_admin') {
      return json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Super admin access required' }
      }, { status: 403 });
    }

    const facultyData = await request.json();
    const { name, code, description } = facultyData;

    // Validate required fields
    if (!name || !code) {
      return json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' }
      }, { status: 400 });
    }

    // Check if faculty code already exists
    const existingFaculty = await db.select()
      .from(faculties)
      .where(eq(faculties.code, code))
      .limit(1);

    if (existingFaculty.length > 0) {
      return json({
        success: false,
        error: { code: 'FACULTY_EXISTS', message: 'Faculty with this code already exists' }
      }, { status: 409 });
    }

    // Create faculty
    const newFaculty = await db.insert(faculties)
      .values({
        name,
        code,
        description: description || null,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: faculties.id,
        name: faculties.name,
        code: faculties.code,
        description: faculties.description,
        status: faculties.status,
        createdAt: faculties.createdAt,
        updatedAt: faculties.updatedAt
      });

    return json({
      success: true,
      data: newFaculty[0]
    });

  } catch (error) {
    console.error('Create faculty error:', error);
    return json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
};