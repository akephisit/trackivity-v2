<script lang="ts">
	import { page } from '$app/state';
	import AdminSidebar from '$lib/components/admin-sidebar.svelte';

	let { data, children } = $props();
	let mobileMenuOpen = $state(false);

	let isLoginPage = $derived(page.url.pathname === '/admin/login');

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

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
		return 'Admin Panel';
	}
</script>

{#if isLoginPage}
	<div class="min-h-screen bg-background">
		{@render children()}
	</div>
{:else}
	<div class="min-h-screen bg-background">
		<AdminSidebar 
			user={data.user} 
			admin_role={data.admin_role} 
			organization={data.organization}
			{mobileMenuOpen}
			onToggleMobileMenu={toggleMobileMenu}
			onCloseMobileMenu={closeMobileMenu}
		/>

		<div class="flex">
			<!-- Main Content -->
				<main class="flex-1 lg:ml-64">
					<!-- Mobile spacing for fixed header -->
					<!-- Remove spacer: header is sticky, not fixed -->

				<!-- Content -->
					<div class="px-4 lg:px-6 py-4 lg:py-6">
						{@render children()}
					</div>
				</main>
			</div>
		</div>
{/if}
