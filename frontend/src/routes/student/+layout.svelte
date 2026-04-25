<script lang="ts">
	import { CalendarDays, FileText, History, House, QrCode, School, User as UserIcon } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppLayout from '$lib/components/app-layout.svelte';
	let { children } = $props();
	let mobileMenuOpen = $state(false);

	const navigationItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: House, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: CalendarDays },
		{ title: 'QR Code', href: '/student/qr', icon: QrCode },
		{ title: 'ประวัติ', href: '/student/history', icon: History },
		{ title: 'สรุปกิจกรรม', href: '/student/summary', icon: FileText },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: UserIcon }
	];

	const bottomNavItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: House, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: CalendarDays },
		{ title: 'QR Code', href: '/student/qr', icon: QrCode },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: UserIcon }
	];

	onMount(async () => {
		await authStore.initialize();

		if (!authStore.isAuthenticated) {
			await goto(`/login?redirectTo=${page.url.pathname}`);
			return;
		}

		// Admins should go to admin portal
		if (authStore.isAdmin) {
			await goto('/admin');
		}
	});
</script>

{#if authStore.loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else if authStore.isAuthenticated && !authStore.isAdmin}
	<AppLayout
		user={authStore.user}
		{navigationItems}
		quickActions={[]}
		{mobileMenuOpen}
		appTitle="Trackivity"
		appSubtitle="Student Portal"
		logoIcon={School}
		showLogo={false}
		onToggleMobileMenu={() => (mobileMenuOpen = !mobileMenuOpen)}
		onCloseMobileMenu={() => (mobileMenuOpen = false)}
		{bottomNavItems}
	>
		{@render children?.()}
	</AppLayout>
{/if}
