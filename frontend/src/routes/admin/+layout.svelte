<script lang="ts">
	import { page } from '$app/state';
	import AdminAppLayout from '$lib/components/admin-app-layout.svelte';

	let { data, children } = $props();
	let mobileMenuOpen = $state(false);

	let isLoginPage = $derived(page.url.pathname === '/admin/login');

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

{#if isLoginPage}
	<div class="min-h-screen bg-background">
		{@render children()}
	</div>
{:else}
	<AdminAppLayout
		user={data.user}
		admin_role={data.admin_role}
		organization={data.organization}
		{mobileMenuOpen}
		onToggleMobileMenu={toggleMobileMenu}
		onCloseMobileMenu={closeMobileMenu}
	>
		{@render children()}
	</AdminAppLayout>
{/if}
