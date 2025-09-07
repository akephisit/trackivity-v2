<script lang="ts">
	import AppLayout from '$lib/components/app-layout.svelte';
	import {
		IconLayoutDashboard,
		IconCalendarEvent,
		IconUsers,
		IconBuilding,
		IconQrcode,
		IconUserCheck,
		IconPlus,
		IconShield,
		IconBuildingStore,
		IconUserCog,
		IconSettings
	} from '@tabler/icons-svelte';

	type AdminLevel = 'SuperAdmin' | 'OrganizationAdmin';

	interface Props {
		user: any;
		admin_role: any;
		organization: any;
		mobileMenuOpen: boolean;
		onToggleMobileMenu: () => void;
		onCloseMobileMenu: () => void;
		children: any;
	}

	let {
		user,
		admin_role,
		organization,
		mobileMenuOpen,
		onToggleMobileMenu,
		onCloseMobileMenu,
		children
	}: Props = $props();

	function getNavigationItems(adminLevel?: AdminLevel) {
		const baseItems = [
			{
				title: 'แดชบอร์ด',
				href: '/admin',
				icon: IconLayoutDashboard,
				exact: true
			},
			{
				title: 'จัดการกิจกรรม',
				href: '/admin/activities',
				icon: IconCalendarEvent
			},
			{
				title: 'สแกน QR Code',
				href: '/admin/qr-scanner',
				icon: IconQrcode
			}
		];

		// เพิ่มรายการเมนูตามระดับแอดมิน
		if (adminLevel === 'SuperAdmin') {
			baseItems.push(
				{
					title: 'จัดการผู้ใช้',
					href: '/admin/users',
					icon: IconUsers
				},
				{
					title: 'จัดการหน่วยงาน',
					href: '/admin/organizations',
					icon: IconBuilding
				},
				{
					title: 'จัดการแอดมิน',
					href: '/admin/admins',
					icon: IconUserCheck
				}
			);
		} else if (adminLevel === 'OrganizationAdmin') {
			// Show departments menu only for faculty-type organizations
			if (organization?.organizationType === 'faculty') {
				baseItems.push({
					title: 'จัดการภาควิชา',
					href: '/admin/departments',
					icon: IconBuildingStore
				});
			}
			baseItems.push(
				{
					title: 'จัดการผู้ใช้หน่วยงาน',
					href: '/admin/organization-users',
					icon: IconUsers
				},
				{
					title: 'จัดการแอดมินหน่วยงาน',
					href: '/admin/organization-admins',
					icon: IconUserCog
				}
			);
		}

		// Show settings menu only for faculty-type organizations
		if (organization?.organizationType === 'faculty') {
			baseItems.push({
				title: 'ตั้งค่า',
				href: '/admin/settings',
				icon: IconSettings
			});
		}

		return baseItems;
	}

	function getQuickActions(adminLevel?: AdminLevel) {
		if (adminLevel === 'OrganizationAdmin') {
			return [
				{
					title: 'สร้างกิจกรรมใหม่',
					href: '/admin/activities/create',
					icon: IconPlus
				}
			];
		}
		return [];
	}

	function getRoleDisplayName(adminLevel?: AdminLevel): string {
		switch (adminLevel) {
			case 'SuperAdmin':
				return 'Super Admin';
			case 'OrganizationAdmin':
				return 'Organization Admin';
			default:
				return 'Admin';
		}
	}

	let navigationItems = $derived(getNavigationItems(admin_role?.admin_level));
	let quickActions = $derived(getQuickActions(admin_role?.admin_level));
	let appSubtitle = $derived(getRoleDisplayName(admin_role?.admin_level));
</script>

<AppLayout
	{user}
	{navigationItems}
	{quickActions}
	{mobileMenuOpen}
	appTitle="Trackivity"
	{appSubtitle}
	logoIcon={IconShield}
	showLogo={true}
	{onToggleMobileMenu}
	{onCloseMobileMenu}
>
	{@render children()}
</AppLayout>
