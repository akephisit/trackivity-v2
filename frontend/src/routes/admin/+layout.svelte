<script lang="ts">
	/**
	 * Admin layout — CSR auth guard
	 * Redirects to /admin/login if not authenticated as admin
	 */
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { organizationsApi, type Organization } from '$lib/api';
	import AdminAppLayout from '$lib/components/admin-app-layout.svelte';

	let { children } = $props();
	let mobileMenuOpen = $state(false);
	let currentOrganization = $state<Organization | null>(null);

	let isLoginPage = $derived(page.url.pathname === '/admin/login');

	onMount(async () => {
		if (isLoginPage) return;

		await authStore.initialize();

		if (!authStore.isAuthenticated) {
			await goto(`/admin/login?redirectTo=${page.url.pathname}`);
			return;
		}

		if (!authStore.isAdmin) {
			await goto('/student');
			return;
		}

		if (authStore.user?.admin_role?.organization_id) {
			try {
				const orgResponse = await organizationsApi.list();
				currentOrganization =
					orgResponse.all.find((o) => o.id === authStore.user?.admin_role?.organization_id) || null;
			} catch (e) {
				console.error('Failed to load organization', e);
			}
		}
	});
</script>

{#if isLoginPage}
	<div class="min-h-screen bg-background">
		{@render children()}
	</div>
{:else if authStore.loading}
	<div class="flex min-h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
		></div>
	</div>
{:else if authStore.isAuthenticated && authStore.isAdmin}
	<AdminAppLayout
		user={authStore.user}
		admin_role={authStore.user?.admin_role ?? null}
		organization={currentOrganization}
		{mobileMenuOpen}
		onToggleMobileMenu={() => (mobileMenuOpen = !mobileMenuOpen)}
		onCloseMobileMenu={() => (mobileMenuOpen = false)}
	>
		{@render children()}
	</AdminAppLayout>
{/if}
