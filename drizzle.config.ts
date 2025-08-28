import { defineConfig } from 'drizzle-kit';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Lightweight .env loader (no external dependency)
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

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
