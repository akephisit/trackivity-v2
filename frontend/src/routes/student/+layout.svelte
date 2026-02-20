<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppLayout from '$lib/components/app-layout.svelte';
	import {
		IconHome,
		IconCalendarEvent,
		IconQrcode,
		IconUser,
		IconHistory,
		IconFileText,
		IconSchool
	} from '@tabler/icons-svelte';

	let { children } = $props();
	let mobileMenuOpen = $state(false);

	const navigationItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: IconHome, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: IconCalendarEvent },
		{ title: 'QR Code', href: '/student/qr', icon: IconQrcode },
		{ title: 'ประวัติ', href: '/student/history', icon: IconHistory },
		{ title: 'สรุปกิจกรรม', href: '/student/summary', icon: IconFileText },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: IconUser }
	];

	const bottomNavItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: IconHome, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: IconCalendarEvent },
		{ title: 'QR Code', href: '/student/qr', icon: IconQrcode },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: IconUser }
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
		logoIcon={IconSchool}
		showLogo={false}
		onToggleMobileMenu={() => (mobileMenuOpen = !mobileMenuOpen)}
		onCloseMobileMenu={() => (mobileMenuOpen = false)}
		{bottomNavItems}
		showAccountSettings={true}
		accountSettingsHref="/student/profile/settings"
	>
		{@render children?.()}
	</AppLayout>
{/if}
