<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activities as activitiesApi, type Activity } from '$lib/api';
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
		IconChartBar,
		IconArrowRight,
		IconPlus
	} from '@tabler/icons-svelte/icons';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getDailyGreeting } from '$lib/utils/greeting';

	let recentActivities = $state<Activity[]>([]);
	let loading = $state(true);

	const user = $derived(authStore.user);
	const adminRole = $derived(authStore.user?.admin_role ?? null);
	const isOrgAdmin = $derived(adminRole?.admin_level === 'organization_admin');

	const greeting = $derived(
		user
			? getDailyGreeting(user.first_name, 'admin')
			: { greeting: 'สวัสดี!', subtitle: 'พร้อมจัดการระบบ' }
	);

	// Placeholder stats — will be replaced when backend stats endpoint exists
	const stats = {
		total_users: 0,
		total_activities: 0,
		active_sessions: 0,
		new_users_this_month: 0,
		organization_users: 0,
		departments_count: 0
	};

	function getMainStats() {
		if (isOrgAdmin) {
			return [
				{ title: 'ผู้ใช้ในหน่วยงาน', value: stats.organization_users, icon: IconUsers },
				{ title: 'กิจกรรมที่จัด', value: stats.total_activities, icon: IconCalendarEvent },
				{ title: 'ภาควิชา', value: stats.departments_count, icon: IconBuilding },
				{ title: 'ผู้ใช้ใหม่เดือนนี้', value: stats.new_users_this_month, icon: IconUsersGroup }
			];
		}
		return [
			{ title: 'ผู้ใช้ทั้งหมด', value: stats.total_users, icon: IconUsers },
			{ title: 'กิจกรรมทั้งหมด', value: stats.total_activities, icon: IconCalendarEvent },
			{ title: 'หน่วยงาน', value: 0, icon: IconBuilding },
			{ title: 'เซสชันใช้งาน', value: stats.active_sessions, icon: IconActivity }
		];
	}

	const mainStats = $derived(getMainStats());

	function getAdminLevelText(level: string | undefined): string {
		switch (level) {
			case 'super_admin': return 'ซุปเปอร์แอดมิน';
			case 'organization_admin': return 'แอดมินหน่วยงาน';
			case 'regular_admin': return 'แอดมินทั่วไป';
			default: return 'ไม่ระบุ';
		}
	}

	function getAdminLevelBadgeVariant(level: string | undefined): 'default' | 'secondary' | 'destructive' {
		switch (level) {
			case 'super_admin': return 'destructive';
			case 'organization_admin': return 'default';
			default: return 'secondary';
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

	onMount(async () => {
		try {
			const dashboard = await activitiesApi.dashboard();
			recentActivities = dashboard.recent;
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	});
</script>

<MetaTags title="แดชบอร์ดแอดมิน" description="ภาพรวมสถิติและการจัดการระบบ" />

<div class="space-y-4 lg:space-y-6">
	<!-- Welcome Section -->
	<div class="rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 lg:p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 flex-1">
				<h2 class="admin-page-title mb-1 truncate flex items-center gap-2">
					<IconActivity class="size-6 text-primary" />
					{greeting.greeting}
				</h2>
				<p class="text-sm text-muted-foreground lg:text-base">
					{greeting.subtitle}
				</p>
			</div>
			<div class="flex-shrink-0">
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
							<p class="text-lg font-bold text-foreground lg:text-2xl">
								{(stat.value || 0).toLocaleString()}
							</p>
						</div>
						<div class="ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 lg:h-12 lg:w-12">
							<stat.icon class="h-5 w-5 text-primary lg:h-6 lg:w-6" />
						</div>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Quick Actions -->
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
					<div class="py-8 text-center">
						<div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
					</div>
				{:else if recentActivities.length > 0}
					<div class="space-y-3">
						{#each recentActivities.slice(0, 4) as activity}
							<div class="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
								<div class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
									<IconActivity class="h-4 w-4 text-primary" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-foreground">{activity.title}</p>
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

		<!-- System Status -->
		{#if !isOrgAdmin}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<IconTrendingUp class="h-5 w-5" />
						สถานะระบบ
					</CardTitle>
					<CardDescription>ภาพรวมการทำงานของระบบ</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm">Uptime</span>
							<span class="text-sm font-semibold text-green-600">99.9%</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm">กิจกรรมล่าสุด</span>
							<span class="text-sm font-semibold">{recentActivities.length}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		{/if}
	</div>
</div>
