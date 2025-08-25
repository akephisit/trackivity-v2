import { json } from '@sveltejs/kit';

export const POST = async ({ cookies }: { cookies: any }) => {
  try {
    // Clear the session cookie
    cookies.delete('session_token', { path: '/' });

    return json({
      success: true,
      data: { message: 'Logged out successfully' }
    });

  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, we should clear the cookie
    cookies.delete('session_token', { path: '/' });
    
    return json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  }
};
