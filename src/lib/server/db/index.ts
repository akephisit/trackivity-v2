import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/trackivity';

// Create connection
const connectionString = DATABASE_URL;
const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema
export * from './schema';