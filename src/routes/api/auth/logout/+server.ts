import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * User logout endpoint
 * Clears JWT session token from httpOnly cookie
 */
export const POST: RequestHandler = async ({ cookies }) => {
  try {
    // Clear the JWT session token cookie
    cookies.delete('session_token', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return json({
      success: true,
      data: { 
        message: 'Successfully logged out',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Auth] Logout error:', error);
    
    // Even if there's an error, we should still clear the cookie
    cookies.delete('session_token', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Return success anyway since logout is idempotent
    return json({
      success: true,
      data: { 
        message: 'Logged out (with cleanup)',
        timestamp: new Date().toISOString()
      }
    });
  }
};