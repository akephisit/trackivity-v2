import { redirect } from '@sveltejs/kit';

// Old org-admin route — the user list page is now scoped automatically by
// the caller's admin level on the backend, so org admins land on the same
// /admin/users page as super admins (with the "หน่วยงาน" column hidden).
// This redirect keeps any old bookmarks working.
export const load = () => {
	throw redirect(307, '/admin/users');
};
