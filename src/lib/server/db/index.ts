import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
// Create connection; avoid throwing during SvelteKit build
const connectionString = env.DATABASE_URL || (building ? 'postgres://user:pass@localhost:5432/dummy' : '');
if (!connectionString && !building) {
    throw new Error('DATABASE_URL is not set in environment');
}
const client = postgres(connectionString, {
	max: 20,
	idle_timeout: 20,
	connect_timeout: 10
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema
export * from './schema';
