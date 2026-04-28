<script lang="ts">
	import type { Component } from 'svelte';
	import type { Snippet } from 'svelte';
	import { LogOut, Menu, Moon, Settings, Shield, Sun, X, type IconProps } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import NotificationBell from './NotificationBell.svelte';

	type IconComponent = Component<IconProps>;

	interface NavigationItem {
		title: string;
		href: string;
		icon: IconComponent;
		exact?: boolean;
	}

	interface QuickAction {
		title: string;
		href: string;
		icon: IconComponent;
		exact?: boolean;
	}

	interface User {
		first_name?: string;
		last_name?: string;
		email?: string;
	}

	interface Props {
		user: User | null;
		navigationItems: NavigationItem[];
		quickActions?: QuickAction[];
		mobileMenuOpen: boolean;
		appTitle: string;
		appSubtitle: string;
		logoIcon?: IconComponent;
		showLogo?: boolean;
		children: Snippet;
		onToggleMobileMenu: () => void;
		onCloseMobileMenu: () => void;
		bottomNavItems?: NavigationItem[];
		showAccountSettings?: boolean;
		accountSettingsHref?: string;
	}

	let {
		user,
		navigationItems,
		quickActions = [],
		mobileMenuOpen,
		appTitle,
		appSubtitle,
		logoIcon = Shield,
		showLogo = true,
		children,
		onToggleMobileMenu,
		onCloseMobileMenu,
		bottomNavItems = [],
		showAccountSettings = false,
		accountSettingsHref = '/profile/settings'
	}: Props = $props();

	function toggleTheme() {
		setMode(mode.current === 'light' ? 'dark' : 'light');
	}

	import { auth } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';

	async function handleLogout() {
		try {
			await auth.logout();
			authStore.clear();
			toast.success('ออกจากระบบสำเร็จ');
			goto('/', { invalidateAll: true });
		} catch (error) {
			console.error('Logout error:', error);
			toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
		}
	}

	function isActiveRoute(href: string, exact: boolean = false): boolean {
		const currentPath = page.url.pathname;
		return exact ? currentPath === href : currentPath.startsWith(href);
	}
</script>

<div class="flex h-[100dvh] flex-col overflow-hidden bg-background">
	<!-- Mobile Header (top of the column flex) -->
	<header class="z-40 shrink-0 border-b bg-card lg:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" onclick={onToggleMobileMenu} class="p-2">
					{#if mobileMenuOpen}
						<X class="size-5" />
					{:else}
						<Menu class="size-5" />
					{/if}
				</Button>
				<h1 class="text-lg font-semibold">{appTitle}</h1>
			</div>

			{#if user}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						{user.first_name}
					</span>
					<NotificationBell />
					<Button variant="ghost" size="sm" onclick={toggleTheme} class="p-2">
						{#if mode.current === 'light'}
							<Moon class="size-4" />
						{:else}
							<Sun class="size-4" />
						{/if}
					</Button>
					<Button variant="ghost" size="sm" onclick={handleLogout} class="p-2">
						<LogOut class="size-4" />
					</Button>
				</div>
			{/if}
		</div>
	</header>

	<!-- Mobile Sidebar Overlay -->
	{#if mobileMenuOpen}
		<div
			class="fixed inset-0 z-40 bg-black/20 lg:hidden"
			onclick={onCloseMobileMenu}
			onkeydown={(e) => e.key === 'Escape' && onCloseMobileMenu()}
			role="button"
			tabindex="0"
			aria-label="Close mobile menu"
		></div>
	{/if}

	<div class="flex min-h-0 flex-1">
		<!-- Desktop Sidebar -->
		<div class="fixed top-0 left-0 hidden h-[100dvh] w-64 border-r bg-card lg:block">
			<aside class="relative flex h-full flex-col overflow-hidden">
				<!-- Logo -->
				<div class="border-b p-6">
					{#if showLogo}
						{@const IconComponent = logoIcon}
						<div class="flex items-center space-x-3">
							<div
								class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary"
							>
								<IconComponent class="!h-5 !w-5 text-primary-foreground" />
							</div>
							<div class="flex flex-col items-start">
								<h1 class="text-xl font-bold text-foreground">{appTitle}</h1>
								<p class="mt-1 text-sm text-muted-foreground">
									{appSubtitle}
								</p>
							</div>
						</div>
					{:else}
						<div>
							<h1 class="text-xl font-bold text-foreground">{appTitle}</h1>
							<p class="mt-1 text-sm text-muted-foreground">{appSubtitle}</p>
						</div>
					{/if}
				</div>

				<!-- Navigation -->
				<nav class="flex-1 space-y-2 overflow-y-auto px-4 py-6 pb-28">
					{#each navigationItems as item}
						{@const IconComponent = item.icon}
						<a
							href={item.href}
							class={cn(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
								isActiveRoute(item.href, item.exact)
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'
							)}
						>
							<IconComponent class="size-5" />
							{item.title}
						</a>
					{/each}

					{#if quickActions.length > 0}
						<div class="pt-6">
							<p
								class="px-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>
								การดำเนินการด่วน
							</p>
							{#each quickActions as action}
								{@const IconComponent = action.icon}
								<a
									href={action.href}
									class={cn(
										'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
										isActiveRoute(action.href, action.exact)
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:bg-muted hover:text-foreground'
									)}
								>
									<IconComponent class="size-5" />
									{action.title}
								</a>
							{/each}
						</div>
					{/if}
				</nav>

				<!-- User Info -->
				{#if user}
					<div class="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
						<div class="space-y-2">
							<div class="flex items-center space-x-3">
								<div class="flex-shrink-0">
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
										<span class="text-sm font-medium text-white">
											{user.first_name?.charAt(0) || user.email?.charAt(0) || 'U'}
										</span>
									</div>
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-foreground">
										{user.first_name
											? `${user.first_name} ${user.last_name || ''}`.trim()
											: user.email || 'User'}
									</p>
								</div>
							</div>
							{#if showAccountSettings}
								<Button variant="ghost" size="sm" class="w-full justify-start">
									<a href={accountSettingsHref} class="flex w-full items-center">
										<Settings class="mr-2 size-4" />
										ตั้งค่าบัญชี
									</a>
								</Button>
							{/if}
							<Button variant="ghost" size="sm" onclick={toggleTheme} class="w-full justify-start">
								{#if mode.current === 'light'}
									<Moon class="mr-2 size-4" />
									โหมดมืด
								{:else}
									<Sun class="mr-2 size-4" />
									โหมดสว่าง
								{/if}
							</Button>
							<Button variant="ghost" size="sm" onclick={handleLogout} class="w-full justify-start">
								<LogOut class="mr-2 size-4" />
								ออกจากระบบ
							</Button>
						</div>
					</div>
				{/if}
			</aside>
		</div>

		<!-- Mobile Sidebar -->
		<aside
			class={cn(
				'fixed top-0 left-0 z-50 flex h-[100dvh] w-64 transform flex-col overflow-hidden border-r bg-card transition-transform duration-300 lg:hidden',
				mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
			)}
		>
			<!-- Logo -->
			<div class="flex items-center justify-between border-b p-6">
				<div class="flex items-center space-x-3">
					{#if showLogo}
						{@const IconComponent = logoIcon}
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary"
						>
							<IconComponent class="!h-5 !w-5 text-primary-foreground" />
						</div>
					{/if}
					<div class="flex flex-col items-start">
						<h1 class="text-xl font-bold text-foreground">{appTitle}</h1>
						<p class="mt-1 text-sm text-muted-foreground">
							{appSubtitle}
						</p>
					</div>
				</div>
				<Button variant="ghost" size="sm" onclick={onCloseMobileMenu} class="p-2">
					<X class="size-5" />
				</Button>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 space-y-2 overflow-y-auto px-4 py-6">
				{#each navigationItems as item}
					{@const IconComponent = item.icon}
					<a
						href={item.href}
						onclick={onCloseMobileMenu}
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							isActiveRoute(item.href, item.exact)
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<IconComponent class="size-5" />
						{item.title}
					</a>
				{/each}

				{#if quickActions.length > 0}
					<div class="pt-6">
						<p
							class="px-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
						>
							การดำเนินการด่วน
						</p>
						{#each quickActions as action}
							{@const IconComponent = action.icon}
							<a
								href={action.href}
								onclick={onCloseMobileMenu}
								class={cn(
									'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
									isActiveRoute(action.href, action.exact)
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'
								)}
							>
								<IconComponent class="size-5" />
								{action.title}
							</a>
						{/each}
					</div>
				{/if}
			</nav>

			<!-- User Info -->
			{#if user}
				<div class="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<div class="space-y-2">
						<div class="flex items-center space-x-3">
							<div class="flex-shrink-0">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
									<span class="text-sm font-medium text-white">
										{user.first_name?.charAt(0) || user.email?.charAt(0) || 'U'}
									</span>
								</div>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-foreground">
									{user.first_name
										? `${user.first_name} ${user.last_name || ''}`.trim()
										: user.email || 'User'}
								</p>
							</div>
						</div>
						{#if showAccountSettings}
							<Button variant="ghost" size="sm" class="w-full justify-start">
								<a href={accountSettingsHref} class="flex w-full items-center">
									<Settings class="mr-2 size-4" />
									ตั้งค่าบัญชี
								</a>
							</Button>
						{/if}
						<Button variant="ghost" size="sm" onclick={toggleTheme} class="w-full justify-start">
							{#if mode.current === 'light'}
								<Moon class="mr-2 size-4" />
								โหมดมืด
							{:else}
								<Sun class="mr-2 size-4" />
								โหมดสว่าง
							{/if}
						</Button>
						<Button variant="ghost" size="sm" onclick={handleLogout} class="w-full justify-start">
							<LogOut class="mr-2 size-4" />
							ออกจากระบบ
						</Button>
					</div>
				</div>
			{/if}
		</aside>

		<!-- Main Content -->
		<main class="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
			<!-- Desktop Top Bar (top of main's column flex, not fixed) -->
			<header class="z-40 hidden shrink-0 border-b bg-card lg:block">
				<div class="flex items-center justify-between px-6 py-3">
					<h1 class="text-lg font-semibold">{appTitle}</h1>
					<div class="flex items-center gap-2">
						{#if user}
							<span class="text-sm text-muted-foreground">{user.first_name}</span>
						{/if}
						<NotificationBell />
						<Button variant="ghost" size="sm" onclick={toggleTheme} class="p-2">
							{#if mode.current === 'light'}
								<Moon class="size-4" />
							{:else}
								<Sun class="size-4" />
							{/if}
						</Button>
						<Button variant="ghost" size="sm" onclick={handleLogout} class="p-2">
							<LogOut class="size-4" />
						</Button>
					</div>
				</div>
			</header>

			<!-- Scroll container — scrollbar lives here, below the topbar -->
			<div class="flex-1 overflow-x-hidden overflow-y-auto">
				<div class="container mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-4">
					{@render children()}
				</div>
			</div>
		</main>
	</div>

	<!-- Bottom Navigation for Mobile (bottom of the column flex) -->
	{#if bottomNavItems.length > 0}
		<nav class="z-30 shrink-0 border-t bg-card lg:hidden">
			<div class="flex items-center justify-around py-2">
				{#each bottomNavItems as item}
					{@const IconComponent = item.icon}
					<a
						href={item.href}
						class={cn(
							'flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
							isActiveRoute(item.href, item.exact) ? 'text-primary' : 'text-muted-foreground'
						)}
					>
						<IconComponent class="size-5 flex-shrink-0" />
						<span class="truncate">{item.title}</span>
					</a>
				{/each}
			</div>
		</nav>
	{/if}
</div>
