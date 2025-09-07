<script lang="ts">
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
		IconSchool,
		IconUsersGroup,
		IconChartBar,
		IconArrowRight,
		IconPlus
	} from '@tabler/icons-svelte/icons';
    import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getDailyGreeting } from '$lib/utils/greeting';

	let { data } = $props();
	
	const isLoading = $derived(!data?.user || !data?.admin_role);
	const isOrgAdmin = $derived(data.admin_role?.admin_level === 'OrganizationAdmin');
	
	// Get dynamic greeting
	const greeting = $derived(
		data.user ? getDailyGreeting(data.user.first_name, 'admin') : { greeting: 'สวัสดี!', subtitle: 'พร้อมจัดการระบบ' }
	);

	// สถิติหลัก
	function getMainStats() {
		const stats = data.stats;

		if (isOrgAdmin) {
			return [
				{
					title: 'ผู้ใช้ในหน่วยงาน',
					value: stats?.organization_users || 0,
					icon: IconUsers,
					trend: '+12%',
					trendUp: true
				},
				{
					title: 'กิจกรรมที่จัด',
					value: stats?.total_activities || 0,
					icon: IconCalendarEvent,
					trend: '+8%',
					trendUp: true
				},
				{
					title: 'ภาควิชา',
					value: stats?.departments_count || 0,
					icon: IconBuilding,
					trend: 'เท่าเดิม',
					trendUp: null
				},
				{
					title: 'ผู้ใช้ใหม่เดือนนี้',
					value: stats?.new_users_this_month || 0,
					icon: IconUsersGroup,
					trend: '+25%',
					trendUp: true
				}
			];
		} else {
			return [
				{
					title: 'ผู้ใช้ทั้งหมด',
					value: stats?.total_users || 0,
					icon: IconUsers,
					trend: '+15%',
					trendUp: true
				},
				{
					title: 'กิจกรรมทั้งหมด',
					value: stats?.total_activities || 0,
					icon: IconCalendarEvent,
					trend: '+12%',
					trendUp: true
				},
				{
					title: 'หน่วยงาน',
					value: stats?.total_users || 0,
					icon: IconBuilding,
					trend: '+3%',
					trendUp: true
				},
				{
					title: 'เซสชันใช้งาน',
					value: stats?.active_sessions || 0,
					icon: IconActivity,
					trend: '+8%',
					trendUp: true
				}
			];
		}
	}

	const mainStats = $derived(getMainStats());

	function getAdminLevelText(level: any): string {
		switch (level) {
			case 'SuperAdmin': return 'ซุปเปอร์แอดมิน';
			case 'OrganizationAdmin': return 'แอดมินหน่วยงาน';
			case 'RegularAdmin': return 'แอดมินทั่วไป';
			default: return 'ไม่ระบุ';
		}
	}

	function getAdminLevelBadgeVariant(level: any): 'default' | 'secondary' | 'destructive' {
		switch (level) {
			case 'SuperAdmin': return 'destructive';
			case 'OrganizationAdmin': return 'default';
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
</script>

<MetaTags title="แดชบอร์ดแอดมิน" description="ภาพรวมสถิติและการจัดการระบบ" />

{#if isLoading}
	<div class="flex items-center justify-center h-64">
		<div class="text-center space-y-4">
			<div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
			<p class="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>
		</div>
	</div>
{:else}
	<div class="space-y-4 lg:space-y-6">
		<!-- Welcome Section -->
		<div class="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-4 lg:p-6">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="min-w-0 flex-1">
					<h2 class="admin-page-title mb-1 truncate">
						<IconActivity class="size-6 text-primary" /> {greeting.greeting}
					</h2>
					<p class="text-sm lg:text-base text-muted-foreground">
						{greeting.subtitle}
						{#if isOrgAdmin && (data.admin_role as any)?.organization}
							<span class="block sm:inline">- {(data.admin_role as any).organization.name}</span>
						{/if}
					</p>
				</div>
				<div class="flex-shrink-0">
					<Badge variant={getAdminLevelBadgeVariant(data.admin_role?.admin_level)} class="text-xs">
						{getAdminLevelText(data.admin_role?.admin_level)}
					</Badge>
				</div>
			</div>
		</div>

		<!-- Main Stats -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
			{#each mainStats as stat}
				<Card class="hover:shadow-sm transition-shadow">
					<CardContent class="p-4 lg:p-6">
						<div class="flex items-center justify-between">
							<div class="min-w-0 flex-1">
								<p class="text-xs lg:text-sm font-medium text-muted-foreground mb-1 truncate">
									{stat.title}
								</p>
								<p class="text-lg lg:text-2xl font-bold text-foreground">
									{(stat.value || 0).toLocaleString()}
								</p>
								{#if stat.trend}
									<p class="text-xs flex items-center mt-1 {stat.trendUp === true ? 'text-green-600' : stat.trendUp === false ? 'text-red-600' : 'text-muted-foreground'} hidden lg:flex">
										<IconTrendingUp class="w-3 h-3 mr-1" />
										{stat.trend}
									</p>
								{/if}
							</div>
							<div class="w-10 h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
								<stat.icon class="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
			<!-- Organization Info (for Org Admin) -->
			{#if isOrgAdmin && (data.admin_role as any)?.organization}
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<IconSchool class="w-5 h-5" />
							ข้อมูลหน่วยงาน
						</CardTitle>
						<CardDescription>
							จัดการข้อมูลและสถิติของหน่วยงาน
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="grid grid-cols-3 gap-4 text-center">
							<div>
								<p class="text-lg font-semibold">
									{(data.admin_role as any).organization.name}
								</p>
								<p class="text-xs text-muted-foreground">ชื่อหน่วยงาน</p>
							</div>
							<div>
								<p class="text-lg font-semibold text-primary">
									{data.stats?.departments_count || 0}
								</p>
								<p class="text-xs text-muted-foreground">ภาควิชา</p>
							</div>
							<div>
								<p class="text-lg font-semibold text-primary">
									{data.stats?.organization_users || 0}
								</p>
								<p class="text-xs text-muted-foreground">ผู้ใช้ทั้งหมด</p>
							</div>
						</div>
						<div class="flex gap-2 pt-2">
							<Button size="sm" class="flex-1">
								<IconPlus class="w-4 h-4 mr-2" />
								สร้างกิจกรรม
							</Button>
							<Button variant="outline" size="sm" class="flex-1">
								<IconChartBar class="w-4 h-4 mr-2" />
								รายงาน
							</Button>
						</div>
					</CardContent>
				</Card>
			{/if}

			<!-- Recent Activities -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center justify-between">
						<span class="flex items-center gap-2">
							<IconActivity class="w-5 h-5" />
							กิจกรรมล่าสุด
						</span>
						<Button variant="ghost" size="sm">
							ดูทั้งหมด
							<IconArrowRight class="w-4 h-4 ml-1" />
						</Button>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{#if data.recentActivities && data.recentActivities.length > 0}
						<div class="space-y-3">
							{#each data.recentActivities.slice(0, 4) as activity}
								<div class="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
									<div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
										<IconActivity class="w-4 h-4 text-primary" />
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-foreground">
											{activity.title || activity.description || 'กิจกรรมในระบบ'}
										</p>
										{#if activity.user_name}
											<p class="text-xs text-muted-foreground">
												โดย {activity.user_name}
												{#if activity.department_name}
													- {activity.department_name}
												{/if}
											</p>
										{/if}
										<p class="text-xs text-muted-foreground">
											{formatDateTime(activity.created_at)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8">
							<IconActivity class="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
							<p class="text-sm text-muted-foreground">ยังไม่มีกิจกรรมล่าสุด</p>
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Department Analytics (for Org Admin) -->
			{#if isOrgAdmin && data.stats?.department_breakdown && data.stats.department_breakdown.length > 0}
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<IconChartBar class="w-5 h-5" />
							การกระจายผู้ใช้
						</CardTitle>
						<CardDescription>จำนวนผู้ใช้ในแต่ละภาควิชา</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-3">
							{#each (data.stats.department_breakdown || []).slice(0, 4) as dept}
								<div class="flex items-center justify-between">
									<div class="flex-1">
										<p class="text-sm font-medium truncate">
											{dept.name || 'ไม่ระบุ'}
										</p>
									</div>
									<div class="flex items-center gap-2">
										<div class="w-20 bg-muted rounded-full h-2">
											<div 
												class="bg-primary h-2 rounded-full transition-all" 
												style="width: {Math.min((dept.user_count / Math.max(...(data.stats.department_breakdown || []).map((d: any) => d.user_count || 1))) * 100, 100)}%"
											></div>
										</div>
										<span class="text-sm font-semibold w-8 text-right">
											{dept.user_count || 0}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			{/if}

			<!-- System Status (for Super Admin) -->
			{#if !isOrgAdmin}
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<IconTrendingUp class="w-5 h-5" />
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
								<span class="text-sm">กิจกรรมต่อชั่วโมง</span>
								<span class="text-sm font-semibold">
									{((data.stats?.recent_activities?.length || 0) / 24).toFixed(1)}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm">ผู้ใช้ใหม่วันนี้</span>
								<span class="text-sm font-semibold text-primary">
									{data.stats?.user_registrations_today || 0}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
{/if}
