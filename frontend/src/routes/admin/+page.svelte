<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		activities as activitiesApi,
		usersApi,
		departmentsApi,
		type Activity,
		type UserListItem,
		type Department
	} from '$lib/api';
	import { onMount } from 'svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		IconUsers,
		IconBuilding,
		IconActivity,
		IconTrendingUp,
		IconCalendarEvent,
		IconUsersGroup,
		IconArrowRight,
		IconPlus,
		IconRefresh,
		IconUserCheck,
		IconLayoutDashboard
	} from '@tabler/icons-svelte/icons';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getDailyGreeting } from '$lib/utils/greeting';

	let recentActivities = $state<Activity[]>([]);
	let allUsers = $state<UserListItem[]>([]);
	let allDepartments = $state<Department[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const user = $derived(authStore.user);
	const adminRole = $derived(authStore.user?.admin_role ?? null);
	const isOrgAdmin = $derived(adminRole?.admin_level === 'organization_admin');
	const orgId = $derived(authStore.user?.organization_id ?? adminRole?.organization_id ?? null);
	const orgName = $derived(authStore.user?.organization_name ?? null);

	const greeting = $derived(
		user
			? getDailyGreeting(user.first_name, 'admin')
			: { greeting: 'สวัสดี!', subtitle: 'พร้อมจัดการระบบ' }
	);

	// Compute stats from real data
	const stats = $derived.by(() => {
		if (isOrgAdmin) {
			// Filter users belonging to this organization
			const orgUsers = allUsers.filter((u) => u.organization_name === orgName);
			const activeOrgUsers = orgUsers.filter((u) => u.status === 'active');
			// Activities created in the last 30 days
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			const recentCount = recentActivities.filter(
				(a) => new Date(a.created_at) >= thirtyDaysAgo
			).length;
			return {
				orgUsers: orgUsers.length,
				activeOrgUsers: activeOrgUsers.length,
				departments: allDepartments.length,
				recentActivities: recentCount,
				totalActivities: recentActivities.length
			};
		}
		// Super / regular admin — show system-wide numbers
		const activeUsers = allUsers.filter((u) => u.status === 'active');
		return {
			orgUsers: allUsers.length,
			activeOrgUsers: activeUsers.length,
			departments: allDepartments.length,
			recentActivities: recentActivities.length,
			totalActivities: recentActivities.length
		};
	});

	const mainStats = $derived(
		isOrgAdmin
			? [
					{
						title: 'นักศึกษาในคณะ',
						value: stats.orgUsers,
						icon: IconUsers,
						color: 'text-blue-600'
					},
					{
						title: 'ใช้งานอยู่',
						value: stats.activeOrgUsers,
						icon: IconUserCheck,
						color: 'text-green-600'
					},
					{
						title: 'ภาควิชา',
						value: stats.departments,
						icon: IconBuilding,
						color: 'text-violet-600'
					},
					{
						title: 'กิจกรรมทั้งหมด',
						value: stats.totalActivities,
						icon: IconCalendarEvent,
						color: 'text-orange-600'
					}
				]
			: [
					{
						title: 'ผู้ใช้ทั้งหมด',
						value: stats.orgUsers,
						icon: IconUsers,
						color: 'text-blue-600'
					},
					{
						title: 'ใช้งานอยู่',
						value: stats.activeOrgUsers,
						icon: IconUserCheck,
						color: 'text-green-600'
					},
					{
						title: 'กิจกรรมทั้งหมด',
						value: stats.totalActivities,
						icon: IconCalendarEvent,
						color: 'text-orange-600'
					},
					{
						title: 'ภาควิชา',
						value: stats.departments,
						icon: IconBuilding,
						color: 'text-violet-600'
					}
				]
	);

	function getAdminLevelText(level: string | undefined): string {
		switch (level) {
			case 'super_admin':
				return 'ซุปเปอร์แอดมิน';
			case 'organization_admin':
				return 'แอดมินหน่วยงาน';
			case 'regular_admin':
				return 'แอดมินทั่วไป';
			default:
				return 'ไม่ระบุ';
		}
	}

	function getAdminLevelBadgeVariant(
		level: string | undefined
	): 'default' | 'secondary' | 'destructive' {
		switch (level) {
			case 'super_admin':
				return 'destructive';
			case 'organization_admin':
				return 'default';
			default:
				return 'secondary';
		}
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActivityStatusBadge(
		status: string
	): 'default' | 'secondary' | 'outline' | 'destructive' {
		switch (status) {
			case 'published':
				return 'default';
			case 'ongoing':
				return 'default';
			case 'completed':
				return 'secondary';
			case 'cancelled':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getActivityStatusText(status: string): string {
		const map: Record<string, string> = {
			draft: 'ร่าง',
			published: 'เผยแพร่',
			ongoing: 'กำลังดำเนินการ',
			completed: 'เสร็จสิ้น',
			cancelled: 'ยกเลิก'
		};
		return map[status] ?? status;
	}

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [dashboard, userResult, depts] = await Promise.all([
				activitiesApi.dashboard().catch(() => ({ recent: [], upcoming: [] })),
				usersApi.list().catch(() => ({ users: [], total: 0 })),
				departmentsApi.list().catch(() => [] as Department[])
			]);
			recentActivities = dashboard.recent;
			allUsers = userResult.users;
			allDepartments = depts;
		} catch (e: any) {
			error = e?.message ?? 'ไม่สามารถโหลดข้อมูลได้';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});
</script>

<MetaTags title="แดชบอร์ดแอดมิน" description="ภาพรวมสถิติและการจัดการระบบ" />

<div class="space-y-4 lg:space-y-6">
	<!-- Welcome Section -->
	<div class="rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 lg:p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 flex-1">
				<h2 class="admin-page-title mb-1 flex items-center gap-2 truncate">
					<IconLayoutDashboard class="size-6 text-primary" />
					{greeting.greeting}
				</h2>
				<p class="text-sm text-muted-foreground lg:text-base">
					{#if isOrgAdmin && orgName}
						{orgName} · {greeting.subtitle}
					{:else}
						{greeting.subtitle}
					{/if}
				</p>
			</div>
			<div class="flex flex-shrink-0 items-center gap-2">
				<Button variant="ghost" size="sm" onclick={loadData} disabled={loading}>
					<IconRefresh class="size-4 {loading ? 'animate-spin' : ''}" />
				</Button>
				<Badge variant={getAdminLevelBadgeVariant(adminRole?.admin_level)} class="text-xs">
					{getAdminLevelText(adminRole?.admin_level)}
				</Badge>
			</div>
		</div>
	</div>

	<!-- Main Stats -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
		{#each mainStats as stat}
			<Card class="transition-shadow hover:shadow-sm">
				<CardContent class="p-4 lg:p-6">
					<div class="flex items-center justify-between">
						<div class="min-w-0 flex-1">
							<p class="mb-1 truncate text-xs font-medium text-muted-foreground lg:text-sm">
								{stat.title}
							</p>
							{#if loading}
								<div class="h-7 w-12 animate-pulse rounded bg-muted"></div>
							{:else}
								<p class="text-lg font-bold text-foreground lg:text-2xl">
									{(stat.value || 0).toLocaleString()}
								</p>
							{/if}
						</div>
						<div
							class="ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 lg:h-12 lg:w-12"
						>
							<stat.icon class="h-5 w-5 {stat.color} lg:h-6 lg:w-6" />
						</div>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Content Area -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
		<!-- Recent Activities -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconActivity class="h-5 w-5" />
						กิจกรรมล่าสุด
					</span>
					<Button variant="ghost" size="sm" href="/admin/activities">
						ดูทั้งหมด
						<IconArrowRight class="ml-1 h-4 w-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading}
					<div class="space-y-3">
						{#each Array(4) as _}
							<div class="flex items-center gap-3">
								<div class="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-muted"></div>
								<div class="flex-1 space-y-1">
									<div class="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
									<div class="h-3 w-1/2 animate-pulse rounded bg-muted"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if recentActivities.length > 0}
					<div class="space-y-3">
						{#each recentActivities.slice(0, 5) as activity}
							<div
								class="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
							>
								<div
									class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"
								>
									<IconActivity class="h-4 w-4 text-primary" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class="truncate text-sm font-medium text-foreground">{activity.title}</p>
										<Badge
											variant={getActivityStatusBadge(activity.status)}
											class="shrink-0 text-xs"
										>
											{getActivityStatusText(activity.status)}
										</Badge>
									</div>
									<p class="text-xs text-muted-foreground">{activity.organizer_name}</p>
									<p class="text-xs text-muted-foreground">{formatDateTime(activity.created_at)}</p>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<IconActivity class="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">ยังไม่มีกิจกรรมล่าสุด</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Quick Actions / System Status -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconTrendingUp class="h-5 w-5" />
					{isOrgAdmin ? 'ทางลัด' : 'ภาพรวมระบบ'}
				</CardTitle>
				<CardDescription>
					{isOrgAdmin ? 'เมนูที่ใช้บ่อย' : 'สถานะการทำงานของระบบ'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if isOrgAdmin}
					<div class="space-y-2">
						<Button
							variant="outline"
							class="w-full justify-start gap-3"
							href="/admin/activities/create"
						>
							<IconPlus class="h-4 w-4 text-primary" />
							สร้างกิจกรรมใหม่
						</Button>
						<Button variant="outline" class="w-full justify-start gap-3" href="/admin/activities">
							<IconCalendarEvent class="h-4 w-4 text-orange-500" />
							จัดการกิจกรรม
						</Button>
						<Button
							variant="outline"
							class="w-full justify-start gap-3"
							href="/admin/organization-users"
						>
							<IconUsers class="h-4 w-4 text-blue-500" />
							ดูนักศึกษาในคณะ
						</Button>
						<Button variant="outline" class="w-full justify-start gap-3" href="/admin/departments">
							<IconBuilding class="h-4 w-4 text-violet-500" />
							จัดการภาควิชา
						</Button>
					</div>
				{:else}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm">ผู้ใช้ทั้งหมด</span>
							<span class="text-sm font-semibold"
								>{loading ? '...' : allUsers.length.toLocaleString()}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm">กิจกรรมล่าสุด</span>
							<span class="text-sm font-semibold">{loading ? '...' : recentActivities.length}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm">ภาควิชา</span>
							<span class="text-sm font-semibold">{loading ? '...' : allDepartments.length}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm">Uptime</span>
							<span class="text-sm font-semibold text-green-600">99.9%</span>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
