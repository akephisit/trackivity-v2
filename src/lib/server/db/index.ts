import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
// Create connection
const connectionString = env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
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
