<script lang="ts">
	import { currentUser, isAuthenticated } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
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
	import { toast } from 'svelte-sonner';

	let { children } = $props();
	let mobileMenuOpen = $state(false);
	let isLoggingOut = $state(false);

	// Navigation items for students
	const navigationItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: IconHome, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: IconCalendarEvent },
		{ title: 'QR Code', href: '/student/qr', icon: IconQrcode },
		{ title: 'ประวัติ', href: '/student/history', icon: IconHistory },
		{ title: 'สรุปกิจกรรม', href: '/student/summary', icon: IconFileText },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: IconUser }
	];

	// Bottom navigation items for mobile
	const bottomNavItems = [
		{ title: 'หน้าหลัก', href: '/student', icon: IconHome, exact: true },
		{ title: 'กิจกรรม', href: '/student/activities', icon: IconCalendarEvent },
		{ title: 'QR Code', href: '/student/qr', icon: IconQrcode },
		{ title: 'โปรไฟล์', href: '/student/profile', icon: IconUser }
	];

	// Check authentication and user role
	onMount(() => {
		let unsubscribe: () => void = () => {};
		let userUnsubscribe: () => void = () => {};

		(async () => {
			// Ensure we probe server first so store reflects real session
			const { auth } = await import('$lib/stores/auth');
			await auth.validateSession();

			unsubscribe = isAuthenticated.subscribe((authenticated) => {
				if (!authenticated && !isLoggingOut) {
					goto('/login');
				}
			});

			// Check if user is actually a student
			userUnsubscribe = currentUser.subscribe((user) => {
				if (user && (user as any).user_role) {
					const userRole = (user as any).user_role;
					console.log('User role:', userRole); // Debug log

					if (userRole !== 'Student') {
						// Redirect based on their actual role
						switch (userRole) {
							case 'SuperAdmin':
							case 'OrganizationAdmin':
								goto('/admin');
								break;
							default:
								goto('/');
								break;
						}
					}
				}
			});
		})();

		return () => {
			unsubscribe();
			userUnsubscribe();
		};
	});

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<AppLayout
	user={$currentUser}
	{navigationItems}
	quickActions={[]}
	{mobileMenuOpen}
	appTitle="Trackivity"
	appSubtitle="Student Portal"
	logoIcon={IconSchool}
	showLogo={false}
	onToggleMobileMenu={toggleMobileMenu}
	onCloseMobileMenu={closeMobileMenu}
	{bottomNavItems}
	showAccountSettings={true}
	accountSettingsHref="/student/profile/settings"
>
	{@render children?.()}
</AppLayout>
