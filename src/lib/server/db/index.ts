import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
// Create connection
const connectionString = env.DATABASE_URL!;
// Cache fetch connections across Vercel invocations
neonConfig.fetchConnectionCache = true;

// Create Neon HTTP client and drizzle instance
const sql = neon(connectionString);
export const db = drizzle(sql, { schema });

// Export schema
export * from './schema';
