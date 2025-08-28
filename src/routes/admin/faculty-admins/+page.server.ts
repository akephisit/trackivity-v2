import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, adminRoles, users, faculties } from '$lib/server/db';
import { eq, and, or } from 'drizzle-orm';
import { AdminLevel, type FacultyAdminDashboardStats, type ExtendedAdminRole, type Faculty } from '$lib/types/admin';
import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

export const load: PageServerLoad = async (event) => {
  const user = requireAdmin(event);
  const adminLevel = user.admin_role?.admin_level;

  try {
    // โหลด Faculty Admins จากฐานข้อมูลโดยตรง
    const rows = await db
      .select({
        role_id: adminRoles.id,
        user_id: users.id,
        email: users.email,
        prefix: users.prefix,
        first_name: users.firstName,
        last_name: users.lastName,
        student_id: users.studentId,
        status: users.status,
        admin_level: adminRoles.adminLevel,
        faculty_id: adminRoles.facultyId,
        faculty_name: faculties.name,
        faculty_code: faculties.code,
        faculty_status: faculties.status,
        created_at: adminRoles.createdAt,
        updated_at: adminRoles.updatedAt,
        permissions: adminRoles.permissions,
        is_enabled: adminRoles.isEnabled
      })
      .from(adminRoles)
      .innerJoin(users, eq(adminRoles.userId, users.id))
      .leftJoin(faculties, eq(adminRoles.facultyId, faculties.id))
      .where(and(
        // include both faculty_admin and regular_admin
        or(eq(adminRoles.adminLevel, 'faculty_admin'), eq(adminRoles.adminLevel, 'regular_admin')),
        eq(adminRoles.isEnabled, true),
        // FacultyAdmin sees only their faculty
        adminLevel === AdminLevel.FacultyAdmin && user.admin_role?.faculty_id ? eq(adminRoles.facultyId, user.admin_role.faculty_id) : (true as any)
      ))
      .orderBy(faculties.name, users.firstName);

    const prefixLabel = (p?: string | null) => {
      const map: Record<string, string> = {
        Mr: 'นาย',
        Mrs: 'นาง',
        Miss: 'นางสาว',
        Dr: 'ดร.',
        Professor: 'ศาสตราจารย์',
        AssociateProfessor: 'รองศาสตราจารย์',
        AssistantProfessor: 'ผู้ช่วยศาสตราจารย์',
        Lecturer: 'อาจารย์',
        Generic: 'คุณ'
      };
      return p ? (map[p] || '') : '';
    };

    const facultyAdmins: ExtendedAdminRole[] = rows.map((r) => ({
      id: r.role_id,
      user_id: r.user_id,
      admin_level: AdminLevel.FacultyAdmin,
      faculty_id: r.faculty_id || undefined,
      permissions: r.permissions || [],
      is_enabled: !!r.is_enabled,
      created_at: r.created_at?.toISOString() || new Date().toISOString(),
      updated_at: r.updated_at?.toISOString() || new Date().toISOString(),
      user: {
        id: r.user_id,
        email: r.email,
        prefix: r.prefix || 'Generic',
        first_name: r.first_name,
        last_name: r.last_name,
        student_id: r.student_id || undefined,
        status: r.status as any,
        role: 'faculty_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      faculty: r.faculty_id ? {
        id: r.faculty_id,
        name: r.faculty_name || 'ไม่ระบุ',
        code: r.faculty_code || '',
        status: r.faculty_status ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Faculty : undefined,
      // Extended fields for UI
      is_active: false,
      full_name: `${prefixLabel(r.prefix) ? prefixLabel(r.prefix) + ' ' : ''}${r.first_name} ${r.last_name}`.trim(),
      created_at_formatted: r.created_at ? new Date(r.created_at).toLocaleString('th-TH') : new Date().toLocaleString('th-TH'),
      permission_count: (r.permissions || []).length,
      days_since_last_login: undefined,
      assigned_departments: [],
      department_count: 0
    }));

    // Faculties for filter (SuperAdmin only)
    let facultiesList: Faculty[] = [];
    try {
      const fac = await db
        .select({ id: faculties.id, name: faculties.name, code: faculties.code, status: faculties.status, created_at: faculties.createdAt, updated_at: faculties.updatedAt })
        .from(faculties)
        .orderBy(faculties.name);
      facultiesList = fac.map(f => ({
        id: f.id,
        name: f.name,
        code: f.code,
        status: !!f.status,
        created_at: f.created_at?.toISOString() || new Date().toISOString(),
        updated_at: f.updated_at?.toISOString() || new Date().toISOString()
      }));
    } catch {}

    // Stats
    const stats: FacultyAdminDashboardStats = {
      total_users: 0,
      total_activities: 0,
      total_participations: 0,
      active_sessions: 0,
      ongoing_activities: 0,
      user_registrations_today: 0,
      faculty_admin_count: facultyAdmins.length,
      department_admins: facultyAdmins.filter(a => (a.assigned_departments?.length || 0) > 0).length,
      permission_distribution: [],
      recent_activities: [],
      login_frequency: [],
      // Custom section used by the page
      total_admins: facultyAdmins.length as any, // compatible usage in svelte
      active_admins: facultyAdmins.filter(a => a.is_enabled).length as any,
      inactive_admins: facultyAdmins.filter(a => !a.is_enabled).length as any,
      recent_logins: 0 as any,
      total_faculties: facultiesList.length as any
    } as any;

    // Provide form for superforms (create faculty admin)
    const adminCreateSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6).optional(),
      faculty_id: z.string().min(1),
      admin_level: z.nativeEnum(AdminLevel).default(AdminLevel.FacultyAdmin),
      permissions: z.array(z.string()).default([])
    });
    // Adjust schema to match UI form fields
    const uiAdminCreateSchema = z.object({
      prefix: z.string().optional().default(''),
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6).optional(),
      faculty_id: z.string().min(1),
      admin_level: z.nativeEnum(AdminLevel).default(AdminLevel.FacultyAdmin),
      permissions: z.array(z.string()).default([])
    });
    const form = await superValidate(zod(uiAdminCreateSchema));

    return {
      user,
      isSuperAdmin: adminLevel === AdminLevel.SuperAdmin,
      userFacultyId: user.admin_role?.faculty_id || null,
      currentFaculty: adminLevel === AdminLevel.FacultyAdmin ? facultiesList.find(f => f.id === (user.admin_role?.faculty_id || '')) || null : null,
      faculties: adminLevel === AdminLevel.SuperAdmin ? facultiesList : facultiesList.filter(f => f.id === (user.admin_role?.faculty_id || '')),
      stats,
      facultyAdmins,
      form
    };
  } catch (e) {
    console.error('Error loading faculty admins from database:', e);
    throw error(500, 'ไม่สามารถโหลดข้อมูล Faculty Admins ได้');
  }
};
