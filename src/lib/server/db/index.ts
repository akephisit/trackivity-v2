import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
// Create connection
const connectionString = env.DATABASE_URL!;
const client = postgres(connectionString, {
	max: 20,
	idle_timeout: 20,
	connect_timeout: 10,
	max_lifetime: 60 * 60, // 1 hour
	debug: false
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema
export * from './schema';
