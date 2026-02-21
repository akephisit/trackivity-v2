import { type Handle, type HandleServerError } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// With CSR auth, SvelteKit doesn't enforce authentication on server side.
	// It relies on client-side routing and layout guards making calls to backend.
	event.locals.user = null;

	const response = await resolve(event);

	// Add basic security headers (relaxed for CSR to specific APIs)
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// CSP removed/relaxed currently to support direct CSR from varying subdomains

	return response;
};

/**
 * Global error handler with security considerations
 */
export const handleError: HandleServerError = async ({ error, event }) => {
	// Log error with context (but don't expose sensitive info)
	const errorId = crypto.randomUUID();
	console.error(`[Error ${errorId}]`, {
		message: error instanceof Error ? error.message : 'Unknown error',
		pathname: event.url.pathname,
		userAgent: event.request.headers.get('user-agent'),
		userId: event.locals.user?.id || 'anonymous',
		timestamp: new Date().toISOString()
	});

	// Return generic error message to client
	return {
		message: 'An unexpected error occurred. Please try again later.',
		code: `ERROR_${errorId}`
	};
};
