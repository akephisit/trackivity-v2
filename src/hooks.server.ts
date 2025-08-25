import { type Handle, type HandleServerError, redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Determine if path is considered public (never forces login)
function isPublicRoute(pathname: string): boolean {
  // Public pages and assets; extend as needed
  const PUBLIC_PREFIXES = [
    '/api', // proxied backend API
    '/_app', '/build', '/static', '/assets',
    '/favicon', '/manifest', '/robots.txt', '/service-worker.js',
    '/', '/login', '/admin/login', '/register', '/unauthorized', '/offline', '/qr'
  ];
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + (p.endsWith('/') ? '' : '/')));
}

// Which routes need any authenticated user
function isStudentProtected(pathname: string): boolean {
  const PROTECTED_PREFIXES = ['/student', '/dashboard', '/profile', '/activities'];
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Which routes need admin login
function isAdminProtected(pathname: string): boolean {
  const ADMIN_PREFIX = '/admin';
  // Admin login itself is public
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login')) return false;
  return pathname === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX + '/');
}

// JWT validation function
function validateJWT(token: string): any | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded;
    } catch (error) {
        console.error('JWT validation failed:', error);
        return null;
    }
}
// Permission helpers (for fine-grained admin pages)
function isAdmin(decoded: any): boolean {
    return decoded.is_admin === true;
}

function isFacultyAdmin(decoded: any): boolean {
    return decoded.admin_level === 'faculty_admin' || decoded.admin_level === 'super_admin';
}

function isSuperAdmin(decoded: any): boolean {
    return decoded.admin_level === 'super_admin';
}

// Main handle function
export const handle: Handle = async ({ event, resolve }) => {
    const { url, cookies } = event;
    const pathname = url.pathname;

    // Initialize locals
    event.locals.user = null;
    
    // Skip auth enforcement for public routes
    if (isPublicRoute(pathname)) {
        return resolve(event);
    }

    // Check JWT token
    const token = cookies.get('session_token');
    if (token) {
        const decoded = validateJWT(token);
        if (decoded) {
            // Set user info in locals
            event.locals.user = {
                id: decoded.user_id,
                student_id: decoded.student_id,
                email: decoded.email,
                first_name: decoded.first_name,
                last_name: decoded.last_name,
                is_admin: decoded.is_admin,
                admin_level: decoded.admin_level,
                faculty_id: decoded.faculty_id
            };
        }
    }

    // Enforce authentication for protected routes
    const needsAuth = isStudentProtected(pathname) || isAdminProtected(pathname);
    if (needsAuth && !event.locals.user) {
        const returnUrl = encodeURIComponent(url.pathname + url.search);
        // Admin sections redirect to admin login
        if (isAdminProtected(pathname)) {
            throw redirect(303, `/admin/login?redirectTo=${returnUrl}`);
        }
        // Student sections go to normal login
        throw redirect(303, `/login?redirectTo=${returnUrl}`);
    }

    // Extra admin checks for admin area
    if (isAdminProtected(pathname) && event.locals.user) {
        if (!event.locals.user.is_admin) {
            throw redirect(303, '/unauthorized');
        }
    }

    // Resolve the request
    const response = await resolve(event);

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    response.headers.set(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss:;`
    );

    return response;
};

// Error handling
export const handleError: HandleServerError = async ({ error, event }) => {
    console.error('Server error:', error);

    // Log error details for debugging
    if (event.locals.user) {
        console.error('User context:', {
            user_id: event.locals.user.id,
            email: event.locals.user.email,
            url: event.url.pathname
        });
    }

    // Return user-friendly error message
    return {
        message: 'An unexpected error occurred. Please try again later.',
        code: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    };
};
