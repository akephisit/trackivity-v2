import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Enhanced connection validation
if (!env.DATABASE_URL) {
	console.error('[DB] DATABASE_URL environment variable is not defined');
	throw new Error('DATABASE_URL environment variable is required');
}

// Create connection with enhanced configuration for production
const connectionString = env.DATABASE_URL!;
console.log('[DB] Initializing database connection:', {
	host: connectionString.includes('@') ? connectionString.split('@')[1].split('/')[0] : 'unknown',
	database: connectionString.includes('/') ? connectionString.split('/').pop()?.split('?')[0] : 'unknown',
	environment: env.NODE_ENV || 'unknown'
});

const client = postgres(connectionString, {
	max: 20,
	idle_timeout: 20,
	connect_timeout: 10,
	// Enhanced error handling and logging
	onnotice: (notice) => {
		if (env.NODE_ENV === 'development') {
			console.log('[DB Notice]:', notice);
		}
	},
	onparameter: (key, value) => {
		if (env.NODE_ENV === 'development') {
			console.log(`[DB Parameter] ${key}:`, value);
		}
	},
	connection: {
		application_name: 'trackivity-v2'
	},
	// Retry configuration for production stability
	transform: {
		undefined: null
	}
});

// Test connection on startup
client`SELECT 1 as test`
	.then(() => {
		console.log('[DB] Database connection established successfully');
	})
	.catch((error) => {
		console.error('[DB] Failed to establish database connection:', {
			error: error.message,
			stack: error.stack,
			connectionString: connectionString.replace(/:([^@]*)@/, ':***@'), // Hide password in logs
			environment: env.NODE_ENV
		});
	});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema
export * from './schema';
