import {
	pgTable,
	uuid,
	varchar,
	text,
	boolean,
	timestamp,
	integer,
	decimal,
	date,
	time,
	jsonb,
	unique,
	index,
	pgEnum,
	inet
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===== ENUMS =====
export const userStatus = pgEnum('user_status', ['active', 'inactive', 'suspended']);
export const adminLevel = pgEnum('admin_level', [
	'super_admin',
	'organization_admin',
	'regular_admin'
]);
export const activityStatus = pgEnum('activity_status', [
	'draft',
	'published',
	'ongoing',
	'completed',
	'cancelled'
]);
export const participationStatus = pgEnum('participation_status', [
	'registered',
	'checked_in',
	'checked_out',
	'completed',
	'no_show'
]);
export const subscriptionType = pgEnum('subscription_type', ['basic', 'premium', 'enterprise']);
export const activityType = pgEnum('activity_type', [
	'Academic',
	'Sports',
	'Cultural',
	'Social',
	'Other'
]);
export const notificationType = pgEnum('notification_type', [
	'subscription_expiry',
	'system_alert',
	'admin_notice',
	'faculty_update'
]);
export const notificationStatus = pgEnum('notification_status', [
	'pending',
	'sent',
	'failed',
	'delivered'
]);
export const organizationType = pgEnum('organization_type', [
	'faculty',  // คณะ - can have departments and allow student registration
	'office'    // หน่วยงาน - no departments, no student registration
]);
export const activityLevel = pgEnum('activity_level', [
	'faculty',    // คณะ - Faculty level activities  
	'university'  // มหาวิทยาลัย - University level activities
]);

// ===== CORE TABLES =====

// Organizations table
export const organizations = pgTable(
	'organizations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		name: varchar('name', { length: 255 }).notNull(),
		code: varchar('code', { length: 10 }).notNull().unique(),
		description: text('description'),
		organizationType: organizationType('organization_type').notNull().default('faculty'),
		status: boolean('status').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			statusIdx: index('idx_organizations_status').on(table.status),
			organizationTypeIdx: index('idx_organizations_organization_type').on(table.organizationType)
		};
	}
);

// Departments table
export const departments = pgTable(
	'departments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		name: varchar('name', { length: 255 }).notNull(),
		code: varchar('code', { length: 10 }).notNull(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		description: text('description'),
		status: boolean('status').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			codeOrganizationUnique: unique().on(table.code, table.organizationId)
		};
	}
);

// Users table
export const users = pgTable(
	'users',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		studentId: varchar('student_id', { length: 20 }).notNull().unique(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		passwordHash: varchar('password_hash', { length: 255 }).notNull(),
		// Title prefix (e.g., Mr, Mrs, Miss, Dr, etc.)
		prefix: varchar('prefix', { length: 50 }).notNull().default('Generic'),
		firstName: varchar('first_name', { length: 100 }).notNull(),
		lastName: varchar('last_name', { length: 100 }).notNull(),
		phone: varchar('phone', { length: 20 }),
		address: text('address'),
		qrSecret: varchar('qr_secret', { length: 255 }).notNull().unique(),
		status: userStatus('status').notNull().default('active'),
		departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			studentIdIdx: index('idx_users_student_id').on(table.studentId),
			emailIdx: index('idx_users_email').on(table.email),
			departmentIdIdx: index('idx_users_department_id').on(table.departmentId)
		};
	}
);

// Admin roles table
export const adminRoles = pgTable(
	'admin_roles',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(),
		adminLevel: adminLevel('admin_level').notNull(),
		organizationId: uuid('organization_id').references(() => organizations.id, {
			onDelete: 'cascade'
		}),
		permissions: text('permissions')
			.array()
			.notNull()
			.default(sql`'{}'`),
		isEnabled: boolean('is_enabled').notNull().default(true),
		lastSessionId: varchar('last_session_id', { length: 255 }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			userIdIdx: index('idx_admin_roles_user_id').on(table.userId),
			organizationIdIdx: index('idx_admin_roles_organization_id').on(table.organizationId),
			isEnabledIdx: index('idx_admin_roles_is_enabled').on(table.isEnabled),
			lastSessionIdx: index('idx_admin_roles_last_session').on(table.lastSessionId)
		};
	}
);

// Activities table
export const activities = pgTable(
	'activities',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description').notNull(),
		location: varchar('location', { length: 255 }).notNull(),
		activityType: activityType('activity_type'),
		academicYear: varchar('academic_year', { length: 20 }).notNull(),
		// organizerId replaces legacy text organizer; references organizations
		organizerId: uuid('organizer_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'restrict' }),
		// Activity level - distinguishes between faculty and university activities
		activityLevel: activityLevel('activity_level').notNull().default('faculty'),
		eligibleOrganizations: jsonb('eligible_organizations')
			.notNull()
			.default(sql`'[]'`),
		startDate: date('start_date').notNull(),
		endDate: date('end_date').notNull(),
		startTimeOnly: time('start_time_only').notNull(),
		endTimeOnly: time('end_time_only').notNull(),
		hours: integer('hours').notNull(),
		maxParticipants: integer('max_participants'),
        registrationOpen: boolean('registration_open').notNull().default(false),
		status: activityStatus('status').notNull().default('draft'),
		organizationId: uuid('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			organizerIdIdx: index('idx_activities_organizer_id').on(table.organizerId),
			organizationIdIdx: index('idx_activities_organization_id').on(table.organizationId),
			createdByIdx: index('idx_activities_created_by').on(table.createdBy),
			statusIdx: index('idx_activities_status').on(table.status),
			academicYearIdx: index('idx_activities_academic_year').on(table.academicYear),
			activityTypeIdx: index('idx_activities_activity_type').on(table.activityType),
			startDateIdx: index('idx_activities_start_date').on(table.startDate),
			activityLevelIdx: index('idx_activities_activity_level').on(table.activityLevel),
			eligibleOrganizationsIdx: index('idx_activities_eligible_organizations').using(
				'gin',
				table.eligibleOrganizations
			)
		};
	}
);

// Participations table
export const participations = pgTable(
	'participations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		activityId: uuid('activity_id')
			.notNull()
			.references(() => activities.id, { onDelete: 'cascade' }),
		status: participationStatus('status').notNull().default('registered'),
		registeredAt: timestamp('registered_at', { withTimezone: true }).default(sql`NOW()`),
		checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
		checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
		notes: text('notes')
	},
	(table) => {
		return {
			userActivityUnique: unique().on(table.userId, table.activityId),
			userIdIdx: index('idx_participations_user_id').on(table.userId),
			activityIdIdx: index('idx_participations_activity_id').on(table.activityId),
			statusIdx: index('idx_participations_status').on(table.status)
		};
	}
);

// Subscriptions table
export const subscriptions = pgTable(
	'subscriptions',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(),
		subscriptionType: subscriptionType('subscription_type').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			userIdIdx: index('idx_subscriptions_user_id').on(table.userId),
			expiresAtIdx: index('idx_subscriptions_expires_at').on(table.expiresAt)
		};
	}
);

// Sessions table
export const sessions = pgTable(
	'sessions',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deviceInfo: jsonb('device_info').default(sql`'{}'`),
		ipAddress: inet('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		lastAccessed: timestamp('last_accessed', { withTimezone: true }).default(sql`NOW()`),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		isActive: boolean('is_active').default(true)
	},
	(table) => {
		return {
			userIdIdx: index('idx_sessions_user_id').on(table.userId),
			expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
			isActiveIdx: index('idx_sessions_is_active').on(table.isActive),
			lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessed)
		};
	}
);

// ===== ANALYTICS TABLES =====

// Organization analytics table
export const organizationAnalytics = pgTable(
	'organization_analytics',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' })
			.unique(),
		totalStudents: integer('total_students').default(0),
		activeStudents: integer('active_students').default(0),
		totalActivities: integer('total_activities').default(0),
		completedActivities: integer('completed_activities').default(0),
		averageParticipationRate: decimal('average_participation_rate', {
			precision: 5,
			scale: 2
		}).default('0.00'),
		monthlyActivityCount: integer('monthly_activity_count').default(0),
		departmentCount: integer('department_count').default(0),
		calculatedAt: timestamp('calculated_at', { withTimezone: true }).default(sql`NOW()`),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			organizationIdIdx: index('idx_organization_analytics_organization_id').on(
				table.organizationId
			),
			calculatedAtIdx: index('idx_organization_analytics_calculated_at').on(table.calculatedAt)
		};
	}
);

// Department analytics table
export const departmentAnalytics = pgTable(
	'department_analytics',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		departmentId: uuid('department_id')
			.notNull()
			.references(() => departments.id, { onDelete: 'cascade' }),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		totalStudents: integer('total_students').default(0),
		activeStudents: integer('active_students').default(0),
		totalActivities: integer('total_activities').default(0),
		participationRate: decimal('participation_rate', { precision: 5, scale: 2 }).default('0.00'),
		calculatedAt: timestamp('calculated_at', { withTimezone: true }).default(sql`NOW()`),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			departmentIdIdx: index('idx_department_analytics_department_id').on(table.departmentId),
			organizationIdIdx: index('idx_department_analytics_organization_id').on(table.organizationId)
		};
	}
);

// System analytics table
export const systemAnalytics = pgTable('system_analytics', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	totalOrganizations: integer('total_organizations').default(0),
	totalDepartments: integer('total_departments').default(0),
	totalUsers: integer('total_users').default(0),
	totalActivities: integer('total_activities').default(0),
	activeSubscriptions: integer('active_subscriptions').default(0),
	expiringSubscriptions7d: integer('expiring_subscriptions_7d').default(0),
	expiringSubscriptions1d: integer('expiring_subscriptions_1d').default(0),
	systemUptimeHours: decimal('system_uptime_hours', { precision: 10, scale: 2 }).default('0'),
	avgResponseTimeMs: decimal('avg_response_time_ms', { precision: 8, scale: 2 }).default('0'),
	calculatedAt: timestamp('calculated_at', { withTimezone: true }).default(sql`NOW()`),
	createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`)
});

// Organization activity requirements table
export const organizationActivityRequirements = pgTable(
	'organization_activity_requirements',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' })
			.unique(),
		requiredFacultyHours: integer('required_faculty_hours').notNull().default(0),
		requiredUniversityHours: integer('required_university_hours').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(table) => {
		return {
			organizationIdIdx: index('idx_organization_activity_requirements_organization_id').on(
				table.organizationId
			)
		};
	}
);

// ===== NOTIFICATION TABLES =====

// Subscription notifications table
export const subscriptionNotifications = pgTable(
	'subscription_notifications',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		subscriptionId: uuid('subscription_id')
			.notNull()
			.references(() => subscriptions.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		notificationType: notificationType('notification_type').notNull(),
		status: notificationStatus('status').notNull().default('pending'),
		title: varchar('title', { length: 255 }).notNull(),
		message: text('message').notNull(),
		daysUntilExpiry: integer('days_until_expiry'),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		emailSent: boolean('email_sent').default(false),
		sseSent: boolean('sse_sent').default(false),
		adminNotified: boolean('admin_notified').default(false),
		metadata: jsonb('metadata').default(sql`'{}'`),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			subscriptionIdIdx: index('idx_subscription_notifications_subscription_id').on(
				table.subscriptionId
			),
			userIdIdx: index('idx_subscription_notifications_user_id').on(table.userId),
			statusIdx: index('idx_subscription_notifications_status').on(table.status),
			daysUntilExpiryIdx: index('idx_subscription_notifications_days_until_expiry').on(
				table.daysUntilExpiry
			)
		};
	}
);

// Email queue table
export const emailQueue = pgTable(
	'email_queue',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		toEmail: varchar('to_email', { length: 255 }).notNull(),
		toName: varchar('to_name', { length: 255 }),
		subject: varchar('subject', { length: 500 }).notNull(),
		bodyText: text('body_text').notNull(),
		bodyHtml: text('body_html'),
		priority: integer('priority').default(1),
		status: notificationStatus('status').notNull().default('pending'),
		attempts: integer('attempts').default(0),
		maxAttempts: integer('max_attempts').default(3),
		scheduledFor: timestamp('scheduled_for', { withTimezone: true }).default(sql`NOW()`),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		errorMessage: text('error_message'),
		metadata: jsonb('metadata').default(sql`'{}'`),
		createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`)
	},
	(table) => {
		return {
			statusIdx: index('idx_email_queue_status').on(table.status),
			priorityIdx: index('idx_email_queue_priority').on(table.priority),
			scheduledForIdx: index('idx_email_queue_scheduled_for').on(table.scheduledFor)
		};
	}
);

// Subscription expiry log table
export const subscriptionExpiryLog = pgTable(
	'subscription_expiry_log',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		subscriptionId: uuid('subscription_id')
			.notNull()
			.references(() => subscriptions.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		daysUntilExpiry: integer('days_until_expiry').notNull(),
		notificationSent: boolean('notification_sent').default(false),
		adminAlerted: boolean('admin_alerted').default(false),
		checkTimestamp: timestamp('check_timestamp', { withTimezone: true }).default(sql`NOW()`),
		metadata: jsonb('metadata').default(sql`'{}'`)
	},
	(table) => {
		return {
			subscriptionIdIdx: index('idx_subscription_expiry_log_subscription_id').on(
				table.subscriptionId
			),
			checkTimestampIdx: index('idx_subscription_expiry_log_check_timestamp').on(
				table.checkTimestamp
			)
		};
	}
);

// ===== RELATIONS & TYPES =====

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Participation = typeof participations.$inferSelect;
export type NewParticipation = typeof participations.$inferInsert;
export type AdminRole = typeof adminRoles.$inferSelect;
export type NewAdminRole = typeof adminRoles.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OrganizationActivityRequirement = typeof organizationActivityRequirements.$inferSelect;
export type NewOrganizationActivityRequirement = typeof organizationActivityRequirements.$inferInsert;
