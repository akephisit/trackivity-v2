import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth-utils';
import { db, adminRoles, users, organizations } from '$lib/server/db';
import { eq, and, or } from 'drizzle-orm';
import {
	AdminLevel,
	type OrganizationAdminDashboardStats,
	type ExtendedAdminRole,
	type Organization
} from '$lib/types/admin';
import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

export const load: PageServerLoad = async (event) => {
	const user = requireAdmin(event);
	const adminLevel = user.admin_role?.admin_level;

	try {
		// Load Organization Admins from database
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
				organization_id: adminRoles.organizationId,
				organization_name: organizations.name,
				organization_code: organizations.code,
				organization_status: organizations.status,
				created_at: adminRoles.created_at,
				updated_at: adminRoles.updated_at,
				permissions: adminRoles.permissions,
				is_enabled: adminRoles.isEnabled
			})
			.from(adminRoles)
			.innerJoin(users, eq(adminRoles.userId, users.id))
			.leftJoin(organizations, eq(adminRoles.organizationId, organizations.id))
			.where(
				and(
					// include both organization_admin and regular_admin
					or(
						eq(adminRoles.adminLevel, 'organization_admin'),
						eq(adminRoles.adminLevel, 'regular_admin')
					),
					eq(adminRoles.isEnabled, true),
					// OrganizationAdmin sees only their organization
					adminLevel === AdminLevel.OrganizationAdmin && (user.admin_role as any)?.organization_id
						? eq(adminRoles.organizationId, (user.admin_role as any).organization_id)
						: (true as any)
				)
			)
			.orderBy(organizations.name, users.firstName);

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
			return p ? map[p] || '' : '';
		};

		const organizationAdmins: ExtendedAdminRole[] = rows.map((r) => ({
			id: r.role_id,
			user_id: r.user_id,
			admin_level: AdminLevel.OrganizationAdmin,
			organization_id: (r as any).organization_id || undefined,
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
				role: 'organization_admin',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			},
			organization: (r as any).organization_id
				? ({
						id: (r as any).organization_id,
						name: (r as any).organization_name || 'ไม่ระบุ',
						code: (r as any).organization_code || '',
						status: (r as any).organization_status ?? true,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					} as Organization)
				: undefined,
			// Extended fields for UI
			is_active: false,
			full_name:
				`${prefixLabel(r.prefix) ? prefixLabel(r.prefix) + ' ' : ''}${r.first_name} ${r.last_name}`.trim(),
			created_at_formatted: r.created_at
				? new Date(r.created_at).toLocaleString('th-TH')
				: new Date().toLocaleString('th-TH'),
			permission_count: (r.permissions || []).length,
			days_since_last_login: undefined,
			assigned_departments: [],
			department_count: 0
		}));

		// Organizations for filter (SuperAdmin only)
		let organizationsList: Organization[] = [];
		try {
			const org = await db
				.select({
					id: organizations.id,
					name: organizations.name,
					code: organizations.code,
					status: organizations.status,
					created_at: organizations.created_at,
					updated_at: organizations.updated_at
				})
				.from(organizations)
				.orderBy(organizations.name);
			organizationsList = org.map((f) => ({
				id: f.id,
				name: f.name,
				code: f.code,
				status: !!f.status,
				created_at: f.created_at?.toISOString() || new Date().toISOString(),
				updated_at: f.updated_at?.toISOString() || new Date().toISOString()
			}));
		} catch {}

		// Stats
		const stats: OrganizationAdminDashboardStats = {
			total_users: 0,
			total_activities: 0,
			total_participations: 0,
			active_sessions: 0,
			ongoing_activities: 0,
			user_registrations_today: 0,
			organization_admin_count: organizationAdmins.length,
			department_admins: organizationAdmins.filter((a) => (a.assigned_departments?.length || 0) > 0)
				.length,
			permission_distribution: [],
			recent_activities: [],
			login_frequency: [],
			// Custom section used by the page
			total_admins: organizationAdmins.length as any, // compatible usage in svelte
			active_admins: organizationAdmins.filter((a) => a.is_enabled).length as any,
			inactive_admins: organizationAdmins.filter((a) => !a.is_enabled).length as any,
			recent_logins: 0 as any,
			total_organizations: organizationsList.length as any
		} as any;

		// Provide form for superforms (create faculty admin)
		const adminCreateSchema = z.object({
			name: z.string().min(1),
			email: z.string().email(),
			password: z.string().min(6).optional(),
			organization_id: z.string().min(1),
			admin_level: z.nativeEnum(AdminLevel).default(AdminLevel.OrganizationAdmin),
			permissions: z.array(z.string()).default([])
		});
		// Adjust schema to match UI form fields
		const uiAdminCreateSchema = z.object({
			prefix: z.string().optional().default(''),
			first_name: z.string().min(1),
			last_name: z.string().min(1),
			email: z.string().email(),
			password: z.string().min(6).optional(),
			organization_id: z.string().min(1),
			admin_level: z.nativeEnum(AdminLevel).default(AdminLevel.OrganizationAdmin),
			permissions: z.array(z.string()).default([])
		});
		const form = await superValidate(zod(uiAdminCreateSchema));

		return {
			user,
			isSuperAdmin: adminLevel === AdminLevel.SuperAdmin,
			userOrganizationId: (user.admin_role as any)?.organization_id || null,
			currentOrganization:
				adminLevel === AdminLevel.OrganizationAdmin
					? organizationsList.find(
							(f) => f.id === ((user.admin_role as any)?.organization_id || '')
						) || null
					: null,
			organizations:
				adminLevel === AdminLevel.SuperAdmin
					? organizationsList
					: organizationsList.filter(
							(f) => f.id === ((user.admin_role as any)?.organization_id || '')
						),
			stats,
			organizationAdmins,
			form
		};
	} catch (e) {
		console.error('Error loading organization admins from database:', e);
		throw error(500, 'ไม่สามารถโหลดข้อมูล Organization Admins ได้');
	}
};
