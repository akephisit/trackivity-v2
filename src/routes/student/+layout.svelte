<script lang="ts">
	import { currentUser, isAuthenticated } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import {
		IconHome,
		IconCalendarEvent,
		IconQrcode,
		IconUser,
		IconHistory,
		IconLogout,
		IconSun,
		IconMoon,
		IconMenu,
		IconX,
		IconFileText
	} from '@tabler/icons-svelte';
	import { page } from '$app/stores';
    import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';

	let { children } = $props();
	let mobileMenuOpen = $state(false);
	let isLoggingOut = $state(false);

	// Navigation items for students
	const navItems = [
		{ href: '/student', icon: IconHome, label: 'หน้าหลัก', exact: true },
		{ href: '/student/activities', icon: IconCalendarEvent, label: 'กิจกรรม' },
		{ href: '/student/qr', icon: IconQrcode, label: 'QR Code' },
		{ href: '/student/history', icon: IconHistory, label: 'ประวัติ' },
		{ href: '/student/summary', icon: IconFileText, label: 'สรุปกิจกรรม' },
		{ href: '/student/profile', icon: IconUser, label: 'โปรไฟล์' }
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
					return;
				}
			});

			userUnsubscribe = currentUser.subscribe((user) => {
				if (user && user.admin_role) {
					// If user is admin, redirect to admin panel
					goto('/admin');
					return;
				}
			});
		})();

		return () => {
			unsubscribe();
			userUnsubscribe();
		};
	});

	function isActiveRoute(href: string, exact = false) {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname.startsWith(href);
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	async function handleLogout() {
		const { auth } = await import('$lib/stores/auth');
		isLoggingOut = true;
		toast.success('ออกจากระบบสำเร็จ');
		await auth.logout('/');
	}

	function toggleTheme() {
		setMode(mode.current === 'light' ? 'dark' : 'light');
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Mobile Header -->
	<header class="sticky top-0 z-40 border-b bg-card lg:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" onclick={toggleMobileMenu} class="p-2">
					{#if mobileMenuOpen}
						<IconX class="size-5" />
					{:else}
						<IconMenu class="size-5" />
					{/if}
				</Button>
				<h1 class="text-lg font-semibold">Trackivity</h1>
			</div>

			{#if $currentUser}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						{$currentUser.first_name}
					</span>
					<Button variant="ghost" size="sm" onclick={toggleTheme} class="p-2">
						{#if mode.current === 'light'}
							<IconMoon class="size-4" />
						{:else}
							<IconSun class="size-4" />
						{/if}
					</Button>
					<Button variant="ghost" size="sm" onclick={handleLogout} class="p-2">
						<IconLogout class="size-4" />
					</Button>
				</div>
			{/if}
		</div>
	</header>

	<div class="flex">
		<!-- Desktop Sidebar -->
		<div class="hidden lg:block sticky top-0 h-screen w-64 border-r bg-card">
			<aside class="relative h-full flex flex-col overflow-hidden">
			<!-- Logo -->
			<div class="border-b p-6">
				<h1 class="text-xl font-bold text-foreground">Trackivity</h1>
				<p class="mt-1 text-sm text-muted-foreground">Student Portal</p>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto space-y-2 px-4 py-6 pb-28">
				{#each navItems as item}
					<a
						href={item.href}
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							isActiveRoute(item.href, item.exact)
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<item.icon class="size-5" />
						{item.label}
					</a>
				{/each}
			</nav>

			<!-- User Info -->
			{#if $currentUser}
				<div class="absolute bottom-0 left-0 right-0 border-t p-4 shrink-0 bg-card">
					<div class="space-y-2">
						<p class="text-sm font-medium">
							{$currentUser.first_name}
							{$currentUser.last_name}
						</p>
						<p class="text-xs text-muted-foreground">
							รหัส: {$currentUser.student_id}
						</p>
						<Button variant="ghost" size="sm" onclick={toggleTheme} class="w-full justify-start">
							{#if mode.current === 'light'}
								<IconMoon class="mr-2 size-4" />
								โหมดมืด
							{:else}
								<IconSun class="mr-2 size-4" />
								โหมดสว่าง
							{/if}
						</Button>
						<Button variant="ghost" size="sm" onclick={handleLogout} class="w-full justify-start">
							<IconLogout class="mr-2 size-4" />
							ออกจากระบบ
						</Button>
					</div>
				</div>
			{/if}
			</aside>
		</div>

		<!-- Mobile Menu Overlay -->
		{#if mobileMenuOpen}
			<div
				class="fixed inset-0 z-50 bg-black/20 lg:hidden"
				role="button"
				tabindex="0"
				aria-label="Close mobile menu"
				onclick={closeMobileMenu}
				onkeydown={(e) => e.key === 'Escape' && closeMobileMenu()}
			></div>
		{/if}

		<!-- Mobile Sidebar -->
		<aside
			class={cn(
				'fixed top-0 left-0 z-50 h-screen w-64 transform flex flex-col overflow-hidden border-r bg-card transition-transform duration-300 lg:hidden',
				mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
			)}
		>
			<!-- Logo -->
			<div class="flex items-center justify-between border-b p-6">
				<div>
					<h1 class="text-xl font-bold text-foreground">Trackivity</h1>
					<p class="mt-1 text-sm text-muted-foreground">Student Portal</p>
				</div>
				<Button variant="ghost" size="sm" onclick={closeMobileMenu} class="p-2">
					<IconX class="size-5" />
				</Button>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto space-y-2 px-4 py-6">
				{#each navItems as item}
					<a
						href={item.href}
						onclick={closeMobileMenu}
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							isActiveRoute(item.href, item.exact)
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<item.icon class="size-5" />
						{item.label}
					</a>
				{/each}
			</nav>

			<!-- User Info -->
			{#if $currentUser}
				<div class="border-t p-4 shrink-0">
					<div class="space-y-2">
						<p class="text-sm font-medium">
							{$currentUser.first_name}
							{$currentUser.last_name}
						</p>
						<p class="text-xs text-muted-foreground">
							รหัส: {$currentUser.student_id}
						</p>
						<Button variant="ghost" size="sm" onclick={toggleTheme} class="w-full justify-start">
							{#if mode.current === 'light'}
								<IconMoon class="mr-2 size-4" />
								โหมดมืด
							{:else}
								<IconSun class="mr-2 size-4" />
								โหมดสว่าง
							{/if}
						</Button>
						<Button variant="ghost" size="sm" onclick={handleLogout} class="w-full justify-start">
							<IconLogout class="mr-2 size-4" />
							ออกจากระบบ
						</Button>
					</div>
				</div>
			{/if}
		</aside>

		<!-- Main Content -->
		<main class="flex-1 lg:ml-0">
			<div class="container mx-auto max-w-7xl px-4 py-6 lg:px-6">
				{@render children?.()}
			</div>
		</main>
	</div>

	<!-- Bottom Navigation for Mobile -->
	<nav class="fixed right-0 bottom-0 left-0 z-30 border-t bg-card lg:hidden">
		<div class="flex items-center justify-around py-2">
			{#each navItems.slice(0, 4) as item}
				<a
					href={item.href}
					class={cn(
						'flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
						isActiveRoute(item.href, item.exact) ? 'text-primary' : 'text-muted-foreground'
					)}
				>
					<item.icon class="size-5 flex-shrink-0" />
					<span class="truncate">{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>

	<!-- Bottom padding for mobile bottom nav -->
	<div class="h-16 lg:hidden"></div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
