import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Allow adding extra trusted origins at build time, e.g. via
// Docker build-arg CSRF_TRUSTED_ORIGINS or env.
function getTrustedOrigins() {
	const defaults = ['http://localhost:5173'];
	const extra = (process.env.CSRF_TRUSTED_ORIGINS || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return [...new Set([...defaults, ...extra])];
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			'@/*': './path/to/lib/*'
		},
		csrf: {
			trustedOrigins: getTrustedOrigins()
		}
	}
};

export default config;
