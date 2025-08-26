import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, adminRoles, users, faculties } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { AdminLevel } from '$lib/types/admin';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
  const user = await requireAdmin(event);
  const adminLevel = user.admin_role?.admin_level;

  // เฉพาะ SuperAdmin เท่านั้นที่ดู Faculty Admins ได้
  if (adminLevel !== AdminLevel.SuperAdmin) {
    throw error(403, 'เฉพาะ Super Admin เท่านั้นที่สามารถดูข้อมูล Faculty Admins ได้');
  }

  try {
    // โหลด Faculty Admins จากฐานข้อมูลโดยตรง
    const facultyAdmins = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.firstName,
        last_name: users.lastName,
        student_id: users.studentId,
        status: users.status,
        admin_level: adminRoles.adminLevel,
        faculty_id: adminRoles.facultyId,
        faculty_name: faculties.name,
        created_at: adminRoles.createdAt
      })
      .from(adminRoles)
      .innerJoin(users, eq(adminRoles.userId, users.id))
      .leftJoin(faculties, eq(adminRoles.facultyId, faculties.id))
      .where(and(
        eq(adminRoles.adminLevel, 'faculty_admin'),
        eq(adminRoles.isEnabled, true)
      ))
      .orderBy(faculties.name, users.firstName);

    return {
      user,
      facultyAdmins
    };
  } catch (e) {
    console.error('Error loading faculty admins from database:', e);
    throw error(500, 'ไม่สามารถโหลดข้อมูล Faculty Admins ได้');
  }
};