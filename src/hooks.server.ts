import { type Handle, type HandleServerError, redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * JWT payload interface for type safety
 */
interface JWTPayload {
  user_id: string;
  student_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id?: string;
  is_admin: boolean;
  admin_level?: string;
  faculty_id?: string;
  iat?: number;
  exp?: number;
}

/**
 * Route configuration for authentication
 */
const ROUTE_CONFIG = {
  // Public routes - no authentication required
  PUBLIC: [
    '/api', // API routes handle their own auth
    '/_app', '/build', '/static', '/assets',
    '/favicon', '/manifest', '/robots.txt', '/service-worker.js',
    '/', '/login', '/register', '/unauthorized', '/offline'
  ],
  
  // Student protected routes - require any authenticated user
  STUDENT_PROTECTED: [
    '/student', '/dashboard', '/profile', '/activities', '/qr', '/history'
  ],
  
  // Admin protected routes - require admin authentication
  ADMIN_PROTECTED: [
    '/admin'
  ],
  
  // Admin login routes - public for admin login
  ADMIN_LOGIN: [
    '/admin/login'
  ]
};

/**
 * Check if route is public (no auth required)
 */
function isPublicRoute(pathname: string): boolean {
  return ROUTE_CONFIG.PUBLIC.some((route) => {
    // Special-case root: only exact match should be public
    if (route === '/') {
      return pathname === '/';
    }
    return (
      pathname === route ||
      pathname.startsWith(route + (route.endsWith('/') ? '' : '/'))
    );
  });
}

/**
 * Check if route requires student-level authentication
 */
function isStudentProtected(pathname: string): boolean {
  return ROUTE_CONFIG.STUDENT_PROTECTED.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

/**
 * Check if route requires admin authentication
 */
function isAdminProtected(pathname: string): boolean {
  // Admin login is public
  if (ROUTE_CONFIG.ADMIN_LOGIN.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )) {
    return false;
  }
  
  return ROUTE_CONFIG.ADMIN_PROTECTED.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

/**
 * Validate JWT token and return decoded payload
 */
function validateJWTToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      console.debug('[Auth] JWT token expired');
      return null;
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.debug('[Auth] Invalid JWT token:', error.message);
    } else {
      console.error('[Auth] JWT validation error:', error);
    }
    return null;
  }
}

/**
 * Create redirect URL with return path
 */
function createRedirectUrl(loginPath: string, returnPath: string, searchParams: string = ''): string {
  const returnUrl = encodeURIComponent(returnPath + (searchParams ? searchParams : ''));
  return `${loginPath}?redirectTo=${returnUrl}`;
}

/**
 * Main authentication middleware
 * Handles JWT validation, route protection, and redirect logic
 */
export const handle: Handle = async ({ event, resolve }) => {
  const { url, cookies } = event;
  const pathname = url.pathname;
  const searchParams = url.search;

  // Initialize user in locals and try to populate from cookie
  event.locals.user = null;
  // Check for JWT session token (httpOnly cookie) for all routes
  const sessionToken = cookies.get('session_token');
  let isAuthenticated = false;
  let isAdmin = false;
  
  if (sessionToken) {
    const decoded = validateJWTToken(sessionToken);
    if (decoded) {
      // Set authenticated user in locals
      event.locals.user = {
        id: decoded.user_id,
        student_id: decoded.student_id,
        email: decoded.email,
        first_name: decoded.first_name,
        last_name: decoded.last_name,
        is_admin: decoded.is_admin || false,
        admin_level: decoded.admin_level,
        faculty_id: decoded.faculty_id
      };
      
      isAuthenticated = true;
      isAdmin = decoded.is_admin || false;
    } else {
      // Invalid or expired token - clear cookie
      cookies.delete('session_token', { path: '/' });
    }
  }

  // Skip authentication enforcement for public routes, but keep locals.user populated
  if (isPublicRoute(pathname)) {
    return resolve(event);
  }

  // Enforce authentication for protected routes
  if (isStudentProtected(pathname) || isAdminProtected(pathname)) {
    if (!isAuthenticated) {
      // Redirect to appropriate login page with return URL
      const redirectPath = isAdminProtected(pathname) 
        ? createRedirectUrl('/admin/login', pathname, searchParams)
        : createRedirectUrl('/login', pathname, searchParams);
      
      throw redirect(303, redirectPath);
    }
    
    // Additional admin check for admin routes
    if (isAdminProtected(pathname) && !isAdmin) {
      throw redirect(303, '/unauthorized');
    }
  }

  // Resolve the request with security headers
  const response = await resolve(event);

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'unsafe-inline'; ` +
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    `font-src 'self' https://fonts.gstatic.com; ` +
    `img-src 'self' data: https:; ` +
    `connect-src 'self' ws: wss:;`
  );

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
