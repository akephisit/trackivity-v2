<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { IconLogout, IconSun, IconMoon, IconMenu, IconX, IconShield, IconSettings } from '@tabler/icons-svelte';
	import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface NavigationItem {
		title: string;
		href: string;
		icon: any;
		exact?: boolean;
	}

	interface QuickAction {
		title: string;
		href: string;
		icon: any;
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
		logoIcon?: any;
		showLogo?: boolean;
		children: any;
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
		logoIcon = IconShield,
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
			const result = await auth.logout();
			if (result.success) {
				authStore.clear();
				toast.success('ออกจากระบบสำเร็จ');
				goto('/', { invalidateAll: true });
			} else {
				toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
			}
		} catch (error) {
			console.error('Logout error:', error);
			toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
		}
	}

	function isActiveRoute(href: string, exact: boolean = false): boolean {
		const currentPath = $page.url.pathname;
		return exact ? currentPath === href : currentPath.startsWith(href);
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Mobile Header -->
	<header class="sticky top-0 z-40 border-b bg-card lg:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" onclick={onToggleMobileMenu} class="p-2">
					{#if mobileMenuOpen}
						<IconX class="size-5" />
					{:else}
						<IconMenu class="size-5" />
					{/if}
				</Button>
				<h1 class="text-lg font-semibold">{appTitle}</h1>
			</div>

			{#if user}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						{user.first_name}
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

	<div class="flex">
		<!-- Desktop Sidebar -->
		<div class="fixed top-0 left-0 hidden h-screen w-64 border-r bg-card lg:block">
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
					<div class="shrink-0 border-t p-4">
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
									<a href={accountSettingsHref} class="flex items-center w-full">
										<IconSettings class="mr-2 size-4" />
										ตั้งค่าบัญชี
									</a>
								</Button>
							{/if}
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

		<!-- Mobile Sidebar -->
		<aside
			class={cn(
				'fixed top-0 left-0 z-50 flex h-screen w-64 transform flex-col overflow-hidden border-r bg-card transition-transform duration-300 lg:hidden',
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
					<IconX class="size-5" />
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
				<div class="shrink-0 border-t p-4">
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
								<a href={accountSettingsHref} class="flex items-center w-full">
									<IconSettings class="mr-2 size-4" />
									ตั้งค่าบัญชี
								</a>
							</Button>
						{/if}
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
		<main class="min-h-screen flex-1 overflow-x-hidden lg:ml-64">
			<!-- Desktop Top Bar -->
			<header class="fixed top-0 right-0 left-64 z-40 hidden border-b bg-card lg:block">
				<div class="flex items-center justify-between px-6 py-3">
					<h1 class="text-lg font-semibold">{appTitle}</h1>
					<div class="flex items-center gap-2">
						{#if user}
							<span class="text-sm text-muted-foreground">{user.first_name}</span>
						{/if}
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
				</div>
			</header>

			<div
				class="container mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pt-4 lg:px-6 lg:py-4 lg:pt-20"
			>
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Bottom Navigation for Mobile -->
	{#if bottomNavItems.length > 0}
		<nav class="fixed right-0 bottom-0 left-0 z-30 border-t bg-card lg:hidden">
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

		<!-- Bottom padding for mobile bottom nav -->
		<div class="h-16 lg:hidden"></div>
	{/if}
</div>
