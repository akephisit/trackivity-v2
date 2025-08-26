import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth';
import { getOptionalAuthUser } from '$lib/server/auth-utils';
import type { Actions, PageServerLoad } from './$types';

/**
 * Login page loader
 * Redirects to dashboard if user is already authenticated
 */
export const load: PageServerLoad = async (event) => {
  const { url } = event;
  
  // Check if user is already authenticated via JWT middleware
  const user = getOptionalAuthUser(event);
  if (user) {
    // User is already logged in, redirect to appropriate dashboard
    const redirectTo = url.searchParams.get('redirectTo') || 
      (user.admin_role ? '/admin' : '/student');
    throw redirect(303, redirectTo);
  }

  // Initialize login form
  const form = await superValidate(zod(loginSchema));
  return { 
    form,
    redirectTo: url.searchParams.get('redirectTo') || null
  };
};

/**
 * Login form actions
 * Handles user authentication via JWT API
 */
export const actions: Actions = {
  default: async (event) => {
    const { request, url, fetch } = event;
    const form = await superValidate(request, zod(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      // Call our JWT login API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: form.data.student_id.includes('@') ? form.data.student_id : undefined,
          student_id: !form.data.student_id.includes('@') ? form.data.student_id : undefined,
          password: form.data.password,
          remember_me: form.data.remember_me,
          device_info: {
            device_type: 'web'
          }
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error?.message || 'Invalid credentials';
        form.errors.student_id = [errorMessage];
        return fail(400, { form });
      }

      // Login successful - JWT cookie is already set by the API
      const user = result.data?.user;
      if (user) {
        // Redirect to appropriate dashboard or return URL
        const redirectTo = url.searchParams.get('redirectTo') || 
          (user.admin_role ? '/admin' : '/student');
        throw redirect(303, redirectTo);
      } else {
        form.errors.student_id = ['Login successful but user data not found'];
        return fail(400, { form });
      }

    } catch (error) {
      // Handle redirect errors (normal flow)
      if (error && typeof error === 'object' && 'status' in (error as any) && 'location' in (error as any)) {
        throw error;
      }
      
      // Handle other errors
      console.error('[Auth] Login form error:', error);
      form.errors.student_id = ['Connection error. Please try again.'];
      return fail(500, { form });
    }
  }
};