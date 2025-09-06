<script lang="ts">
	import { page } from '$app/state';
	import { goto, preloadData } from '$app/navigation';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
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
		IconCalendarEvent
	} from '@tabler/icons-svelte/icons';
	// Use string literal admin level to avoid enum mismatch across modules
	type AdminLevel = 'SuperAdmin' | 'OrganizationAdmin' | 'RegularAdmin';
	import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import type { ComponentProps } from 'svelte';

    interface AdminSidebarProps extends ComponentProps<typeof Sidebar.Root> {
        user?: any;
        admin_role?: {
            admin_level: AdminLevel;
            faculty_id?: string;
            role_name?: string;
            organization_id?: string;
        };
        organization?: { id: string; name: string; organizationType?: 'faculty' | 'office' };
    }

    let { user, admin_role, organization, ...restProps }: AdminSidebarProps = $props();

	// Get sidebar context for mobile menu control
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	const sidebar = useSidebar();

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
	}

    function getNavigationItems(adminLevel?: AdminLevel): NavigationItem[] {
		const baseItems: NavigationItem[] = [
			{
				title: 'แดชบอร์ด',
				href: '/admin',
				icon: IconLayoutDashboard,
				active: page.url.pathname === '/admin'
			},
			{
				title: 'จัดการกิจกรรม',
				href: '/admin/activities',
				icon: IconCalendarEvent,
				active: page.url.pathname.startsWith('/admin/activities'),
				description: 'จัดการกิจกรรมและการเข้าร่วม'
			},
			{
				title: 'สแกน QR Code',
				href: '/admin/qr-scanner',
				icon: IconQrcode,
				active: page.url.pathname.startsWith('/admin/qr-scanner'),
				description: 'สแกน QR Code เพื่อบันทึกการเข้าร่วมกิจกรรม'
			}
		];

		// เพิ่มรายการเมนูตามระดับแอดมิน
		if (adminLevel === 'SuperAdmin') {
			baseItems.push(
				{
					title: 'จัดการผู้ใช้',
					href: '/admin/users',
					icon: IconUsers,
					active: page.url.pathname.startsWith('/admin/users'),
					description: 'จัดการผู้ใช้ทั้งหมดในระบบ'
				},
				{
					title: 'จัดการหน่วยงาน',
					href: '/admin/organizations',
					icon: IconBuilding,
					active: page.url.pathname.startsWith('/admin/organizations'),
					description: 'จัดการข้อมูลหน่วยงานต่างๆ'
				},
				{
					title: 'จัดการแอดมิน',
					href: '/admin/admins',
					icon: IconShield,
					active: page.url.pathname.startsWith('/admin/admins'),
					description: 'จัดการผู้ดูแลระบบ'
				}
			);
        } else if (adminLevel === 'OrganizationAdmin') {
            // Show departments menu only for faculty-type organizations
            if (organization?.organizationType === 'faculty') {
                baseItems.push({
                    title: 'จัดการภาควิชา',
                    href: '/admin/departments',
                    icon: IconBuildingStore,
                    active: page.url.pathname.startsWith('/admin/departments'),
                    description: 'จัดการสาขา/ภาควิชาในหน่วยงาน'
                });
            }
            baseItems.push(
                {
                    title: 'จัดการผู้ใช้หน่วยงาน',
                    href: '/admin/organization-users',
                    icon: IconUsers,
                    active: page.url.pathname.startsWith('/admin/organization-users'),
                    description: 'จัดการผู้ใช้ในหน่วยงาน'
                },
                {
                    title: 'จัดการแอดมินหน่วยงาน',
                    href: '/admin/organization-admins',
                    icon: IconUserCog,
                    active: page.url.pathname.startsWith('/admin/organization-admins'),
                    description: 'จัดการผู้ดูแลหน่วยงาน'
                }
            );
        }

		// Show settings menu for SuperAdmin or faculty-type organizations only
		if (adminLevel === 'SuperAdmin' || organization?.organizationType === 'faculty') {
			baseItems.push({
				title: 'ตั้งค่า',
				href: '/admin/settings',
				icon: IconSettings,
				active: page.url.pathname.startsWith('/admin/settings'),
				description: 'ตั้งค่าระบบ'
			});
		}

		return baseItems;
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

	/**
	 * Navigation handler that closes mobile menu and navigates
	 * @param href - The URL to navigate to
	 * @param event - The click event (optional)
	 */
	function handleNavigation(href: string, event?: Event) {
		if (event) {
			event.preventDefault();
		}
		
		// Close mobile sidebar if we're on mobile
		if (sidebar.isMobile && sidebar.openMobile) {
			sidebar.setOpenMobile(false);
		}
		
		// Navigate to the target URL
		goto(href);
	}

	/**
	 * Preload handler for hover events
	 * @param href - The URL to preload
	 */
	function handlePreload(href: string) {
		preloadData(href);
	}
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<!-- Header -->
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:!p-3">
					{#snippet child({ props })}
						<button 
							{...props} 
							class="flex items-center space-x-3 w-full text-left" 
							onclick={(e) => handleNavigation('/admin', e)}
							onmouseenter={() => handlePreload('/admin')}
						>
							<div
								class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary"
							>
								<IconShield class="!h-5 !w-5 text-primary-foreground" />
							</div>
							<div class="flex flex-col items-start">
								<span class="text-base font-bold">Admin Panel</span>
								<span class="text-xs text-muted-foreground">
									{getRoleDisplayName(admin_role?.admin_level)}
								</span>
							</div>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<!-- Content -->
	<Sidebar.Content>
		<!-- User Info Section -->
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<div class="rounded-lg border border-border bg-muted/50 p-3">
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
				</div>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Navigation Menu -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>เมนูหลัก</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navigationItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={item.active}>
								{#snippet child({ props })}
									<button 
										{...props} 
										class="flex items-center space-x-3 w-full text-left" 
										onclick={(e) => handleNavigation(item.href, e)}
										onmouseenter={() => handlePreload(item.href)}
									>
										{#if item.icon}
											{@const IconComponent = item.icon}
											<IconComponent class="!h-4 !w-4 flex-shrink-0" />
										{/if}
										<div class="flex flex-col items-start">
											<span class="text-sm font-medium">{item.title}</span>
											{#if item.description}
												<span class="text-xs text-muted-foreground">{item.description}</span>
											{/if}
										</div>
									</button>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Quick Actions for Faculty Admin -->
		{#if admin_role?.admin_level === 'OrganizationAdmin'}
			<Sidebar.Group>
				<Sidebar.GroupLabel>การดำเนินการด่วน</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<button 
										{...props} 
										class="flex items-center space-x-3 w-full text-left" 
										onclick={(e) => handleNavigation('/admin/activities/create', e)}
										onmouseenter={() => handlePreload('/admin/activities/create')}
									>
										<IconCalendarEvent class="!h-4 !w-4 flex-shrink-0" />
										<span class="text-sm">สร้างกิจกรรมใหม่</span>
									</button>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<button 
										{...props} 
										class="flex items-center space-x-3 w-full text-left" 
										onclick={(e) => handleNavigation('/admin/reports', e)}
										onmouseenter={() => handlePreload('/admin/reports')}
									>
										<IconUsers class="!h-4 !w-4 flex-shrink-0" />
										<span class="text-sm">รายงานหน่วยงาน</span>
									</button>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>

	<!-- Footer -->
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton onclick={toggleTheme}>
					{#snippet child({ props })}
						<button {...props} class="flex w-full items-center space-x-3">
							{#if mode.current === 'light'}
								<IconMoon class="!h-4 !w-4 flex-shrink-0" />
								<span class="text-sm">โหมดมืด</span>
							{:else}
								<IconSun class="!h-4 !w-4 flex-shrink-0" />
								<span class="text-sm">โหมดสว่าง</span>
							{/if}
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton onclick={handleLogout}>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex w-full items-center space-x-3 text-destructive hover:text-destructive"
						>
							<IconLogout class="!h-4 !w-4 flex-shrink-0" />
							<span class="text-sm">ออกจากระบบ</span>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
