<script lang="ts">
	import { onMount } from 'svelte';
	import { systemApi, organizationsApi } from '$lib/api';
	import type { Analytics, UserSession } from '$lib/api';
	import type { Organization } from '$lib/types';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Progress } from '$lib/components/ui/progress';

	import {
		IconUsers,
		IconSchool,
		IconAnalyze,
		IconShieldCheck,
		IconTrendingUp,
		IconActivity,
		IconDevices,
		IconChevronRight,
		IconAlertCircle,
		IconCrown,
		IconShield,
		IconCalendarEvent,
		IconDatabase,
		IconUserPlus,
		IconPlus
	} from '@tabler/icons-svelte';

	// Component state
	let analytics: Analytics | null = null;
	let faculties: Organization[] = [];
	let activeSessions: UserSession[] = [];
	let loading = {
		analytics: true,
		faculties: true,
		sessions: true
	};
	let error: string | null = null;

	onMount(async () => {
		await Promise.all([loadAnalytics(), loadFaculties(), loadActiveSessions()]);
	});

	async function loadAnalytics() {
		try {
			loading.analytics = true;
			const response = await systemApi.getAnalytics();
			analytics = response;
		} catch (err) {
			console.error('Failed to load analytics:', err);
			error = 'ไม่สามารถโหลดข้อมูลการวิเคราะห์ได้';
		} finally {
			loading.analytics = false;
		}
	}

	async function loadFaculties() {
		try {
			loading.faculties = true;
			const response = await organizationsApi.list();
			// API returns organization array directly
			faculties = response as any;
		} catch (err) {
			console.error('Failed to load faculties:', err);
		} finally {
			loading.faculties = false;
		}
	}

	async function loadActiveSessions() {
		try {
			loading.sessions = true;
			const response = await systemApi.getAllSessions({
				per_page: 10,
				active_only: true
			});

			activeSessions = Array.isArray(response) ? response : (response.data || response.sessions || []);
		} catch (err) {
			console.error('Failed to load sessions:', err);
		} finally {
			loading.sessions = false;
		}
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('th-TH').format(num);
	}

	function getDeviceIcon(deviceType?: string) {
		switch (deviceType) {
			case 'mobile':
				return '📱';
			case 'tablet':
				return '📱';
			default:
				return '💻';
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function calculateFacultyUtilization(faculty: Organization): number {
		if (!faculty.total_students || faculty.total_students === 0) return 0;
		// This would be calculated based on actual participation vs capacity
		// For now using mock calculation
		return Math.min(100, (faculty.total_students / 1000) * 100);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				<IconCrown class="size-6 text-yellow-600" />
				ภาพรวมระบบ
			</h1>
			<p class="text-muted-foreground">แดชบอร์ดสำหรับผู้ดูแลระบบสูงสุด</p>
		</div>
		<div class="flex gap-2">
			<Button size="sm" href="/admin/system/users/create">
				<IconUserPlus class="mr-2 size-4" />
				เพิ่มผู้ใช้
			</Button>
			<Button size="sm" variant="outline" href="/admin/system/organizations/create">
				<IconPlus class="mr-2 size-4" />
				เพิ่มหน่วยงาน
			</Button>
		</div>
	</div>

	<!-- Key Metrics -->
	{#if error}
		<Alert variant="destructive">
			<IconAlertCircle class="size-4" />
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	{/if}

	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle>
				<IconUsers class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading.analytics || !analytics ? '--' : formatNumber(analytics.total_users)}
				</div>
				<p class="text-xs text-muted-foreground">ผู้ใช้ในระบบ</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">กิจกรรมทั้งหมด</CardTitle>
				<IconCalendarEvent class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading.analytics || !analytics ? '--' : formatNumber(analytics.total_activities)}
				</div>
				<p class="text-xs text-muted-foreground">กิจกรรมในระบบ</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">การเข้าร่วมทั้งหมด</CardTitle>
				<IconActivity class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading.analytics || !analytics ? '--' : formatNumber(analytics.total_participations)}
				</div>
				<p class="text-xs text-muted-foreground">การเข้าร่วมกิจกรรม</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เซสชันที่ใช้งาน</CardTitle>
				<IconDevices class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading.analytics || !analytics ? '--' : formatNumber(analytics.active_sessions)}
				</div>
				<p class="text-xs text-muted-foreground">เซสชันออนไลน์</p>
			</CardContent>
		</Card>
	</div>

	<!-- Faculty Overview and Active Sessions -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Faculty Overview -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconSchool class="size-5" />
						ภาพรวมหน่วยงาน
					</span>
					<Button size="sm" variant="outline" href="/admin/system/organizations">
						จัดการหน่วยงาน
						<IconChevronRight class="ml-1 size-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading.faculties}
					<div class="space-y-4">
						{#each Array(3) as _}
							<div class="space-y-2">
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-2 w-full" />
								<Skeleton class="h-3 w-1/2" />
							</div>
						{/each}
					</div>
				{:else if faculties.length === 0}
					<div class="py-6 text-center text-muted-foreground">
						<IconSchool class="mx-auto mb-2 size-8 opacity-50" />
						<p>ยังไม่มีหน่วยงานในระบบ</p>
						<Button size="sm" href="/admin/system/organizations/create" class="mt-2">
							เพิ่มหน่วยงานแรก
						</Button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each faculties.slice(0, 5) as faculty}
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<div>
										<h4 class="text-sm font-medium">{faculty.name}</h4>
										<p class="text-xs text-muted-foreground">{faculty.code}</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">
											{formatNumber(faculty.total_students || 0)} คน
										</p>
										<p class="text-xs text-muted-foreground">
											{formatNumber(faculty.total_activities || 0)} กิจกรรม
										</p>
									</div>
								</div>

								<div class="space-y-1">
									<div class="flex items-center justify-between text-xs">
										<span class="text-muted-foreground">การใช้งาน</span>
										<span>{calculateFacultyUtilization(faculty).toFixed(0)}%</span>
									</div>
									<Progress value={calculateFacultyUtilization(faculty)} class="h-2" />
								</div>
							</div>
						{/each}

						{#if faculties.length > 5}
							<div class="border-t pt-2">
								<Button
									size="sm"
									variant="outline"
									href="/admin/system/organizations"
									class="w-full"
								>
									ดูหน่วยงานทั้งหมด ({faculties.length - 5} อื่น ๆ)
								</Button>
							</div>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Active Sessions -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconShieldCheck class="size-5" />
						เซสชันที่ใช้งาน
					</span>
					<Button size="sm" variant="outline" href="/admin/system/sessions">
						จัดการเซสชัน
						<IconChevronRight class="ml-1 size-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading.sessions}
					<div class="space-y-3">
						{#each Array(5) as _}
							<div class="space-y-2">
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-3 w-1/2" />
							</div>
						{/each}
					</div>
				{:else if activeSessions.length === 0}
					<div class="py-6 text-center text-muted-foreground">
						<IconDevices class="mx-auto mb-2 size-8 opacity-50" />
						<p>ไม่มีเซสชันที่ใช้งาน</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each activeSessions as session}
							<div class="flex items-center justify-between rounded-lg border p-3">
								<div class="flex items-center gap-3">
									<div class="text-lg">
										{getDeviceIcon(session.device_info?.device_type)}
									</div>
									<div>
										<p class="text-sm font-medium">
											เซสชัน {session.session_id.slice(0, 8)}...
										</p>
										<p class="text-xs text-muted-foreground">
											{formatDate(session.last_activity)}
										</p>
									</div>
								</div>
								<Badge variant={session.is_active ? 'default' : 'secondary'}>
									{session.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
								</Badge>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Analytics Chart Placeholder and Quick Actions -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Participation Trends -->
		<Card class="lg:col-span-2">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconTrendingUp class="size-5" />
					แนวโน้มการเข้าร่วมกิจกรรม
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading.analytics || !analytics}
					<div class="flex h-64 items-center justify-center">
						<div class="space-y-2 text-center">
							<Skeleton class="h-32 w-full" />
							<Skeleton class="mx-auto h-4 w-3/4" />
						</div>
					</div>
				{:else}
					<div class="flex h-64 items-center justify-center text-muted-foreground">
						<div class="space-y-2 text-center">
							<IconAnalyze class="mx-auto size-12 opacity-50" />
							<p>กราฟแนวโน้มการเข้าร่วม</p>
							<p class="text-xs">จะแสดงเมื่อมีข้อมูลเพียงพอ</p>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- System Actions -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconShield class="size-5" />
					การดำเนินการระบบ
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<Button href="/admin/system/users" variant="outline" class="w-full justify-start">
						<IconUsers class="mr-2 size-4" />
						จัดการผู้ใช้
					</Button>

					<Button href="/admin/system/organizations" variant="outline" class="w-full justify-start">
						<IconSchool class="mr-2 size-4" />
						จัดการหน่วยงาน
					</Button>

					<Button href="/admin/system/sessions" variant="outline" class="w-full justify-start">
						<IconShieldCheck class="mr-2 size-4" />
						จัดการเซสชัน
					</Button>

					<Button href="/admin/system/admins" variant="outline" class="w-full justify-start">
						<IconShield class="mr-2 size-4" />
						จัดการผู้ดูแลระบบ
					</Button>

					<Button href="/admin/system/settings" variant="outline" class="w-full justify-start">
						<IconDatabase class="mr-2 size-4" />
						ตั้งค่าระบบ
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- System Status -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconAnalyze class="size-5" />
				สถานะระบบ
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-3">
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ระบบฐานข้อมูล</span>
						<Badge variant="default">ปกติ</Badge>
					</div>
					<Progress value={95} class="h-2" />
					<p class="text-xs text-muted-foreground">95% ของพื้นที่ใช้งาน</p>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ระบบการเชื่อมต่อ</span>
						<Badge variant="default">ปกติ</Badge>
					</div>
					<Progress value={98} class="h-2" />
					<p class="text-xs text-muted-foreground">98% uptime</p>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ประสิทธิภาพระบบ</span>
						<Badge variant="default">ดี</Badge>
					</div>
					<Progress value={87} class="h-2" />
					<p class="text-xs text-muted-foreground">เฉลี่ย 87ms response time</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
