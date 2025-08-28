#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import * as schema from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Lightweight .env loader (same as drizzle.config.ts)
(() => {
	try {
		const envPath = resolve(process.cwd(), '.env');
		if (existsSync(envPath)) {
			const content = readFileSync(envPath, 'utf8');
			content.split(/\r?\n/).forEach((line) => {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) return;
				const idx = trimmed.indexOf('=');
				if (idx === -1) return;
				const key = trimmed.slice(0, idx).trim();
				let value = trimmed.slice(idx + 1).trim();
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				if (!process.env[key]) process.env[key] = value;
			});
		}
	} catch (_) {
		// ignore env load errors
	}
})();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

// Database connection
const client = postgres(DATABASE_URL, {
	max: 1
});
const db = drizzle(client, { schema });

interface SuperAdminData {
	studentId: string;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

async function createSuperAdmin(adminData: SuperAdminData) {
	try {
		console.log('🚀 Creating super admin user...');

		// Check if user with email or studentId already exists
		const existingUser = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, adminData.email))
			.limit(1);

		if (existingUser.length > 0) {
			console.log('❌ User with this email already exists');
			return;
		}

		const existingStudentId = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.studentId, adminData.studentId))
			.limit(1);

		if (existingStudentId.length > 0) {
			console.log('❌ User with this student ID already exists');
			return;
		}

		// Hash password
		const saltRounds = 12;
		const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

		// Generate unique QR secret
		const qrSecret = crypto.randomBytes(32).toString('hex');

		// Create user
		const [newUser] = await db
			.insert(schema.users)
			.values({
				studentId: adminData.studentId,
				email: adminData.email,
				passwordHash,
				firstName: adminData.firstName,
				lastName: adminData.lastName,
				qrSecret,
				status: 'active'
			})
			.returning();

		console.log('✅ User created successfully');
		console.log(`   ID: ${newUser.id}`);
		console.log(`   Student ID: ${newUser.studentId}`);
		console.log(`   Email: ${newUser.email}`);
		console.log(`   Name: ${newUser.firstName} ${newUser.lastName}`);

		// Create super admin role
		const [adminRole] = await db
			.insert(schema.adminRoles)
			.values({
				userId: newUser.id,
				adminLevel: 'super_admin',
				permissions: ['*'], // Super admin gets all permissions
				isEnabled: true
			})
			.returning();

		console.log('✅ Super admin role created successfully');
		console.log(`   Role ID: ${adminRole.id}`);
		console.log(`   Admin Level: ${adminRole.adminLevel}`);
		console.log(`   Permissions: ${adminRole.permissions}`);

		console.log('\n🎉 Super admin created successfully!');
		console.log('📋 Login credentials:');
		console.log(`   Email: ${adminData.email}`);
		console.log(`   Password: ${adminData.password}`);
		console.log('\n⚠️  Please change the password after first login!');
	} catch (error) {
		console.error('❌ Error creating super admin:', error);
		throw error;
	} finally {
		await client.end();
	}
}

// Main execution
async function main() {
	console.log('='.repeat(50));
	console.log('🔧 Super Admin Creation Script');
	console.log('='.repeat(50));

	// Get admin data from command line arguments or prompt
	const args = process.argv.slice(2);

	if (args.length < 5) {
		console.log(
			'Usage: npm run create-super-admin <studentId> <email> <password> <firstName> <lastName>'
		);
		console.log(
			'Example: npm run create-super-admin SA001 admin@university.ac.th MySecurePassword123! John Doe'
		);
		process.exit(1);
	}

	const [studentId, email, password, firstName, lastName] = args;

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		console.error('❌ Invalid email format');
		process.exit(1);
	}

	// Validate password strength
	if (password.length < 8) {
		console.error('❌ Password must be at least 8 characters long');
		process.exit(1);
	}

	const adminData: SuperAdminData = {
		studentId,
		email,
		password,
		firstName,
		lastName
	};

	try {
		await createSuperAdmin(adminData);
		console.log('\n✨ Setup completed successfully!');
	} catch (error) {
		console.error('💥 Setup failed:', error);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.main) {
	main().catch(console.error);
}
