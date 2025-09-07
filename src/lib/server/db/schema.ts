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
	inet,
	bigint,
	smallint,
	primaryKey,
	foreignKey
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
	'faculty', // คณะ - can have departments and allow student registration
	'office' // หน่วยงาน - no departments, no student registration
]);
export const activityLevel = pgEnum('activity_level', [
	'faculty', // คณะ - Faculty level activities
	'university' // มหาวิทยาลัย - University level activities
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

// Users table - Optimized
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
		prefix: varchar('prefix', { length: 20 }).notNull().default('Generic'),
		firstName: varchar('first_name', { length: 100 }).notNull(),
		lastName: varchar('last_name', { length: 100 }).notNull(),
		phone: varchar('phone', { length: 15 }),
		address: text('address'),
		qrSecret: varchar('qr_secret', { length: 128 }).notNull().unique(),
		status: userStatus('status').notNull().default('active'),
		departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'restrict' }),
		// Soft delete support
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		// Performance tracking
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
		loginCount: integer('login_count').default(0),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`)
	},
	(table) => {
		return {
			studentIdIdx: index('idx_users_student_id').on(table.studentId),
			emailIdx: index('idx_users_email').on(table.email),
			departmentIdIdx: index('idx_users_department_id').on(table.departmentId),
			statusIdx: index('idx_users_status').on(table.status),
			lastLoginIdx: index('idx_users_last_login').on(table.lastLoginAt),
			// Compound index for active users lookup
			activeUsersIdx: index('idx_users_active_department').on(table.status, table.departmentId),
			// Full text search index for names
			nameSearchIdx: index('idx_users_name_search').using(
				'gin',
				sql`to_tsvector('thai', first_name || ' ' || last_name)`
			)
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

// Activities table - Optimized
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
		academicYear: smallint('academic_year').notNull(), // Use smallint instead of varchar
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
		hours: smallint('hours').notNull(), // Use smallint for hours (0-999)
		maxParticipants: integer('max_participants'),
		registrationOpen: boolean('registration_open').notNull().default(false),
		status: activityStatus('status').notNull().default('draft'),
		organizationId: uuid('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		// Performance counters
		participantCount: integer('participant_count').default(0),
		viewCount: integer('view_count').default(0),
		// Soft delete support
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`)
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
			),
			// Compound indexes for common queries
			statusOrgIdx: index('idx_activities_status_org').on(table.status, table.organizerId),
			dateStatusIdx: index('idx_activities_date_status').on(table.startDate, table.status),
			activeActivitiesIdx: index('idx_activities_active').on(
				table.status,
				table.registrationOpen,
				table.startDate
			),
			// Full text search
			titleSearchIdx: index('idx_activities_title_search').using(
				'gin',
				sql`to_tsvector('thai', title || ' ' || description)`
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

// Sessions table - Optimized (consider moving to Redis in production)
export const sessions = pgTable(
	'sessions',
	{
		id: varchar('id', { length: 128 }).primaryKey(), // Shorter session IDs
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deviceFingerprint: varchar('device_fingerprint', { length: 64 }), // Hash of device info
		ipAddress: inet('ip_address'),
		userAgent: text('user_agent'),
		// Session metadata
		loginMethod: varchar('login_method', { length: 20 }).default('password'), // 'password', 'oauth', etc.
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`),
		lastAccessed: timestamp('last_accessed', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		isActive: boolean('is_active').notNull().default(true)
	},
	(table) => {
		return {
			userIdIdx: index('idx_sessions_user_id').on(table.userId),
			expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
			activeSessionsIdx: index('idx_sessions_active_expires').on(table.isActive, table.expiresAt),
			lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessed)
		};
	}
);

// ===== AUDIT & LOGS TABLES =====

// Audit logs table - Partitioned by date for performance
export const auditLogs = pgTable(
	'audit_logs',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey(), // Use bigint for high-volume logs
		logDate: date('log_date').notNull(), // Partitioning key
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		sessionId: varchar('session_id', { length: 128 }),
		action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete', 'login', etc.
		entityType: varchar('entity_type', { length: 30 }).notNull(), // 'user', 'activity', etc.
		entityId: uuid('entity_id'),
		oldValues: jsonb('old_values'),
		newValues: jsonb('new_values'),
		ipAddress: inet('ip_address'),
		userAgent: text('user_agent'),
		timestamp: timestamp('timestamp', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`)
	},
	(table) => {
		return {
			// Compound primary key for partitioning
			primaryIdx: primaryKey({ columns: [table.logDate, table.id] }),
			userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
			sessionIdIdx: index('idx_audit_logs_session_id').on(table.sessionId),
			actionIdx: index('idx_audit_logs_action').on(table.action),
			entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
			timestampIdx: index('idx_audit_logs_timestamp').on(table.timestamp),
			// Composite indexes for common audit queries
			userActionIdx: index('idx_audit_logs_user_action').on(
				table.userId,
				table.action,
				table.logDate
			)
		};
	}
);

// Activity views table - For tracking popularity
export const activityViews = pgTable(
	'activity_views',
	{
		id: bigint('id', { mode: 'bigint' }).primaryKey(),
		activityId: uuid('activity_id')
			.notNull()
			.references(() => activities.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		viewedAt: timestamp('viewed_at', { withTimezone: true })
			.notNull()
			.default(sql`NOW()`),
		ipAddress: inet('ip_address'),
		sessionId: varchar('session_id', { length: 128 })
	},
	(table) => {
		return {
			activityIdIdx: index('idx_activity_views_activity_id').on(table.activityId),
			userIdIdx: index('idx_activity_views_user_id').on(table.userId),
			viewedAtIdx: index('idx_activity_views_viewed_at').on(table.viewedAt),
			// Composite index for deduplication
			uniqueViewIdx: index('idx_activity_views_unique').on(
				table.activityId,
				table.userId,
				sql`date(viewed_at)`
			)
		};
	}
);

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

// ===== TYPE EXPORTS =====

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
export type NewOrganizationActivityRequirement =
	typeof organizationActivityRequirements.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ActivityView = typeof activityViews.$inferSelect;
export type NewActivityView = typeof activityViews.$inferInsert;

// ===== UTILITY TYPES =====

export type EntityType =
	| 'user'
	| 'activity'
	| 'organization'
	| 'department'
	| 'participation'
	| 'admin_role';
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view' | 'export';
