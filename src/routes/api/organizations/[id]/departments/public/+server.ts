import { json, type RequestHandler } from '@sveltejs/kit';
import { db, departments } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

// Public endpoint: list active departments for a faculty
export const GET: RequestHandler = async ({ params }) => {
  try {
    const facultyId = params.id;
    if (!facultyId) {
      return json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'faculty_id is required' } }, { status: 400 });
    }

    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        faculty_id: departments.facultyId,
        description: departments.description,
        status: departments.status,
        created_at: departments.createdAt,
        updated_at: departments.updatedAt
      })
      .from(departments)
      .where(and(eq(departments.facultyId, facultyId), eq(departments.status, true)))
      .orderBy(departments.name);

    const data = rows.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      faculty_id: d.faculty_id,
      description: d.description || undefined,
      status: !!d.status,
      created_at: d.created_at?.toISOString() || new Date().toISOString(),
      updated_at: d.updated_at?.toISOString() || new Date().toISOString()
    }));

    return json({ success: true, data });
  } catch (error) {
    console.error('Get departments by faculty error:', error);
    return json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 });
  }
};

