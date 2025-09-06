<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import {
		IconLayoutDashboard,
		IconUsers,
		IconBuilding,
		IconSettings,
		IconLogout,
		IconShield,
		IconBuildingStore,
		IconUserCog,
		IconSun,
		IconMoon,
		IconQrcode,
		IconCalendarEvent,
		IconMenu,
		IconX
	} from '@tabler/icons-svelte/icons';
	import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';

	// Use string literal admin level to avoid enum mismatch across modules
	type AdminLevel = 'SuperAdmin' | 'OrganizationAdmin' | 'RegularAdmin';

    interface AdminSidebarProps {
        user?: any;
        admin_role?: {
            admin_level: AdminLevel;
            faculty_id?: string;
            role_name?: string;
            organization_id?: string;
        };
        organization?: { id: string; name: string; organizationType?: 'faculty' | 'office' };
		mobileMenuOpen?: boolean;
		onToggleMobileMenu?: () => void;
		onCloseMobileMenu?: () => void;
    }

    let { 
		user, 
		admin_role, 
		organization, 
		mobileMenuOpen = false, 
		onToggleMobileMenu, 
		onCloseMobileMenu 
	}: AdminSidebarProps = $props();

	// Navigation items based on admin level
	let navigationItems = $derived(getNavigationItems(admin_role?.admin_level));

	// Check if we have user data
	let hasUser = $derived(user != null);

	interface NavigationItem {
		title: string;
		href: string;
		icon: any;
		active: boolean;
		description?: string;
		exact?: boolean;
	}

    function getNavigationItems(adminLevel?: AdminLevel): NavigationItem[] {
		const baseItems: NavigationItem[] = [
			{
				title: 'แดชบอร์ด',
				href: '/admin',
				icon: IconLayoutDashboard,
				active: page.url.pathname === '/admin',
				exact: true
			},
			{
				title: 'จัดการกิจกรรม',
				href: '/admin/activities',
				icon: IconCalendarEvent,
				active: page.url.pathname.startsWith('/admin/activities')
			},
			{
				title: 'สแกน QR Code',
				href: '/admin/qr-scanner',
				icon: IconQrcode,
				active: page.url.pathname.startsWith('/admin/qr-scanner')
			}
		];

		// เพิ่มรายการเมนูตามระดับแอดมิน
		if (adminLevel === 'SuperAdmin') {
			baseItems.push(
				{
					title: 'จัดการผู้ใช้',
					href: '/admin/users',
					icon: IconUsers,
					active: page.url.pathname.startsWith('/admin/users')
				},
				{
					title: 'จัดการหน่วยงาน',
					href: '/admin/organizations',
					icon: IconBuilding,
					active: page.url.pathname.startsWith('/admin/organizations')
				},
				{
					title: 'จัดการแอดมิน',
					href: '/admin/admins',
					icon: IconShield,
					active: page.url.pathname.startsWith('/admin/admins')
				}
			);
        } else if (adminLevel === 'OrganizationAdmin') {
            // Show departments menu only for faculty-type organizations
            if (organization?.organizationType === 'faculty') {
                baseItems.push({
                    title: 'จัดการภาควิชา',
                    href: '/admin/departments',
                    icon: IconBuildingStore,
                    active: page.url.pathname.startsWith('/admin/departments')
                });
            }
            baseItems.push(
                {
                    title: 'จัดการผู้ใช้หน่วยงาน',
                    href: '/admin/organization-users',
                    icon: IconUsers,
                    active: page.url.pathname.startsWith('/admin/organization-users')
                },
                {
                    title: 'จัดการแอดมินหน่วยงาน',
                    href: '/admin/organization-admins',
                    icon: IconUserCog,
                    active: page.url.pathname.startsWith('/admin/organization-admins')
                }
            );
        }

		// Show settings menu for SuperAdmin or faculty-type organizations only
		if (adminLevel === 'SuperAdmin' || organization?.organizationType === 'faculty') {
			baseItems.push({
				title: 'ตั้งค่า',
				href: '/admin/settings',
				icon: IconSettings,
				active: page.url.pathname.startsWith('/admin/settings')
			});
		}

		return baseItems;
	}

	// Quick actions for Organization Admin
	let quickActions = $derived(getQuickActions(admin_role?.admin_level));

	function getQuickActions(adminLevel?: AdminLevel): NavigationItem[] {
		if (adminLevel === 'OrganizationAdmin') {
			return [
				{
					title: 'สร้างกิจกรรมใหม่',
					href: '/admin/activities/create',
					icon: IconCalendarEvent,
					active: page.url.pathname === '/admin/activities/create'
				},
				{
					title: 'รายงานหน่วยงาน',
					href: '/admin/reports',
					icon: IconUsers,
					active: page.url.pathname.startsWith('/admin/reports')
				}
			];
		}
		return [];
	}

	async function handleLogout() {
		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST'
			});

			if (response.ok) {
				toast.success('ออกจากระบบสำเร็จ');
				goto('/');
			} else {
				toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
			}
		} catch (error) {
			console.error('Logout error:', error);
			toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
		}
	}

	function toggleTheme() {
		setMode(mode.current === 'light' ? 'dark' : 'light');
	}

	function getAdminLevelText(level?: string) {
		if (level === 'SuperAdmin' || level === 'super_admin') return 'ซุปเปอร์แอดมิน';
		if (level === 'OrganizationAdmin' || level === 'organization_admin') return 'แอดมินหน่วยงาน';
		return 'แอดมินทั่วไป';
	}

	function getRoleDisplayName(level?: AdminLevel, facultyName?: string) {
		if (level === 'SuperAdmin') {
			return 'ซุปเปอร์แอดมิน';
		} else if (level === 'OrganizationAdmin') {
			return facultyName ? `แอดมินหน่วยงาน${facultyName}` : 'แอดมินหน่วยงาน';
		}
		return 'แอดมิน';
	}

	function isActiveRoute(href: string, exact = false) {
		if (exact) {
			return page.url.pathname === href;
		}
		return page.url.pathname.startsWith(href);
	}

	function closeMobileMenu() {
		if (onCloseMobileMenu) {
			onCloseMobileMenu();
		}
	}

	// Page title for headers (mobile)
	function getPageTitle() {
		if (page.url.pathname === '/admin') return 'แดชบอร์ด';
		if (page.url.pathname.startsWith('/admin/activities')) return 'จัดการกิจกรรม';
		if (page.url.pathname.startsWith('/admin/organizations')) return 'จัดการหน่วยงาน';
		if (page.url.pathname.startsWith('/admin/users')) return 'จัดการผู้ใช้';
		if (page.url.pathname.startsWith('/admin/admins')) return 'จัดการแอดมิน';
		if (page.url.pathname.startsWith('/admin/departments')) return 'จัดการภาควิชา';
		if (page.url.pathname.startsWith('/admin/organization-users')) return 'จัดการผู้ใช้หน่วยงาน';
		if (page.url.pathname.startsWith('/admin/organization-admins')) return 'จัดการแอดมินหน่วยงาน';
		if (page.url.pathname.startsWith('/admin/qr-scanner')) return 'สแกน QR Code';
		if (page.url.pathname.startsWith('/admin/reports')) return 'รายงานหน่วยงาน';
		if (page.url.pathname.startsWith('/admin/settings')) return 'ตั้งค่า';
		return 'Trackivity';
	}
</script>

<!-- Mobile Header -->
<header class="sticky top-0 z-40 border-b bg-card lg:hidden">
	<div class="flex items-center justify-between px-4 py-3">
		<div class="flex items-center gap-3">
			<Button 
				variant="ghost" 
				size="sm" 
				onclick={onToggleMobileMenu} 
				class="p-2"
			>
				{#if mobileMenuOpen}
					<IconX class="size-5" />
				{:else}
					<IconMenu class="size-5" />
				{/if}
			</Button>
			<h1 class="text-lg font-semibold">Trackivity</h1>
		</div>

		{#if hasUser}
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

<!-- Desktop Sidebar (fixed so it won't push content) -->
<div class="hidden lg:block fixed top-0 left-0 h-screen w-64 border-r bg-card">
	<aside class="relative h-full flex flex-col overflow-hidden">
		<!-- Logo -->
		<div class="border-b p-6">
			<div class="flex items-center space-x-3">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
					<IconShield class="!h-5 !w-5 text-primary-foreground" />
				</div>
				<div class="flex flex-col items-start">
					<h1 class="text-xl font-bold text-foreground">Trackivity</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						{getRoleDisplayName(admin_role?.admin_level)}
					</p>
				</div>
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto space-y-2 px-4 py-6 pb-28">
			{#each navigationItems as item}
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
					{item.title}
				</a>
			{/each}

			{#if quickActions.length > 0}
				<div class="pt-6">
					<p class="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
						การดำเนินการด่วน
					</p>
					{#each quickActions as action}
						<a
							href={action.href}
							class={cn(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
								isActiveRoute(action.href, action.exact)
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'
							)}
						>
							<action.icon class="size-5" />
							{action.title}
						</a>
					{/each}
				</div>
			{/if}
		</nav>

		<!-- User Info -->
		{#if hasUser}
			<div class="absolute bottom-0 left-0 right-0 border-t p-4 shrink-0 bg-card">
				<div class="space-y-2">
					<div class="flex items-center space-x-3">
						<div class="flex-shrink-0">
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
								<span class="text-sm font-medium text-white">
									{hasUser
										? (user.first_name?.charAt(0) || user.email?.charAt(0))?.toUpperCase()
										: 'A'}
								</span>
							</div>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">
								{hasUser
									? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
									: 'Admin'}
							</p>
							<p class="truncate text-xs text-muted-foreground">
								{getAdminLevelText(admin_role?.admin_level)}
							</p>
						</div>
					</div>
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
		<div class="flex items-center space-x-3">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
				<IconShield class="!h-5 !w-5 text-primary-foreground" />
			</div>
			<div class="flex flex-col items-start">
				<h1 class="text-xl font-bold text-foreground">Trackivity</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					{getRoleDisplayName(admin_role?.admin_level)}
				</p>
			</div>
		</div>
		<Button variant="ghost" size="sm" onclick={closeMobileMenu} class="p-2">
			<IconX class="size-5" />
		</Button>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto space-y-2 px-4 py-6">
		{#each navigationItems as item}
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
				{item.title}
			</a>
		{/each}

		{#if quickActions.length > 0}
			<div class="pt-6">
				<p class="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
					การดำเนินการด่วน
				</p>
				{#each quickActions as action}
					<a
						href={action.href}
						onclick={closeMobileMenu}
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							isActiveRoute(action.href, action.exact)
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<action.icon class="size-5" />
						{action.title}
					</a>
				{/each}
			</div>
		{/if}
	</nav>

	<!-- User Info -->
	{#if hasUser}
		<div class="border-t p-4 shrink-0">
			<div class="space-y-2">
				<div class="flex items-center space-x-3">
					<div class="flex-shrink-0">
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
							<span class="text-sm font-medium text-white">
								{hasUser
									? (user.first_name?.charAt(0) || user.email?.charAt(0))?.toUpperCase()
									: 'A'}
							</span>
						</div>
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">
							{hasUser
								? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
								: 'Admin'}
						</p>
						<p class="truncate text-xs text-muted-foreground">
							{getAdminLevelText(admin_role?.admin_level)}
						</p>
					</div>
				</div>
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
