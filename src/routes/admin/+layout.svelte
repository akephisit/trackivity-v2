<script lang="ts">
	import { page } from '$app/state';
    import AdminSidebar from '$lib/components/admin-sidebar.svelte';
    import { Button } from '$lib/components/ui/button';
    import { mode, setMode } from 'mode-watcher';
    import { toast } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { IconSun, IconMoon, IconLogout } from '@tabler/icons-svelte/icons';

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
        return 'Trackivity';
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
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
                    <!-- Desktop Top Bar -->
                    <header class="hidden lg:block sticky top-0 z-40 border-b bg-card">
                        <div class="flex items-center justify-between px-6 py-3">
                            <h1 class="text-lg font-semibold">Trackivity</h1>
                            <div class="flex items-center gap-2">
                                {#if data?.user}
                                    <span class="text-sm text-muted-foreground">{data.user.first_name}</span>
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

                    <!-- Content -->
                    	<div class="px-4 lg:px-6 py-4 lg:py-6">
                            {@render children()}
                        </div>
                    </main>
			</div>
		</div>
{/if}
