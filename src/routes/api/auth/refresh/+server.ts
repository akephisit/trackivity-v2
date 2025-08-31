import { json, type RequestHandler } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/auth-utils';

/**
 * Session refresh endpoint
 * Validates current session and returns current user; can be used for keep-alive.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const user = getAuthenticatedUser(event);
    if (!user) {
      return json(
        { success: false, error: { code: 'NO_SESSION', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Optionally, could re-issue/extend cookie expiry here if desired.
    return json({ success: true, data: { user } });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to refresh session' } },
      { status: 500 }
    );
  }
};

