import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { adminLoginSchema } from '$lib/schemas/auth';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import type { Actions, PageServerLoad } from './$types';

/**
 * Admin login page loader
 * Redirects to admin dashboard if admin is already authenticated
 */
export const load: PageServerLoad = async (event) => {
  const { url } = event;
  
  // Check if user is already authenticated and is an admin
  const user = getOptionalAuthUser(event);
  if (user && user.admin_role) {
    // Admin is already logged in, redirect to admin dashboard
    const redirectTo = url.searchParams.get('redirectTo') || '/admin';
    throw redirect(303, redirectTo);
  }

  // Initialize admin login form
  const form = await superValidate(zod(adminLoginSchema));
  
  return {
    form,
    redirectTo: url.searchParams.get('redirectTo') || null,
    isDevelopment: process.env.NODE_ENV === 'development'
  };
};

/**
 * Admin login form actions
 * Handles admin authentication via JWT API
 */
export const actions: Actions = {
  default: async (event) => {
    const { request, url, fetch, cookies } = event;
    const form = await superValidate(request, zod(adminLoginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      // Authenticate directly via server-side service, then set cookie
      const { authenticateAndIssueToken } = await import('$lib/server/auth-service');
      const { user, token } = await authenticateAndIssueToken({
        email: form.data.email,
        password: form.data.password
      });

      if (!user || !user.admin_role) {
        form.errors._errors = ['Access denied. Admin privileges required.'];
        return fail(403, { form });
      }

      cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      });

      const redirectTo = url.searchParams.get('redirectTo') || '/admin';
      throw redirect(303, redirectTo);

    } catch (error) {
      // Handle redirect errors (normal flow)
      if (error && typeof error === 'object' && 'status' in (error as any) && 'location' in (error as any)) {
        throw error;
      }
      
      // Handle other errors
      console.error('[Auth] Admin login form error:', error);
      form.errors._errors = ['Connection error. Please try again.'];
      return fail(500, { form });
    }
  }
};
