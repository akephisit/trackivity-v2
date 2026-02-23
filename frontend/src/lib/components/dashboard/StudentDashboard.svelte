<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activitiesApi, type Activity, type Participation } from '$lib/api';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { onMount } from 'svelte';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';

	import {
		IconQrcode,
		IconCalendarEvent,
		IconHistory,
		IconTrendingUp,
		IconUsers,
		IconClock,
		IconMapPin,
		IconChevronRight,
		IconAlertCircle
	} from '@tabler/icons-svelte';

	// Loading states
	let loadingActivities = $state(true);
	let loadingParticipations = $state(true);
	let error: string | null = $state(null);

	// Data
	let recentActivities = $state<Activity[]>([]);
	let upcomingActivities = $state<Activity[]>([]);
	let participations = $state<Participation[]>([]);

	// Derived stats from real data
	const totalParticipations = $derived(participations.length);
	const thisMonth = new Date().getMonth();
	const thisYear = new Date().getFullYear();
	const thisMonthParticipations = $derived(
		participations.filter((p) => {
			if (!p.registered_at) return false;
			const d = new Date(p.registered_at);
			return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
		}).length
	);
	const upcomingCount = $derived(upcomingActivities.length);

	onMount(async () => {
		// Fetch dashboard activities
		activitiesApi
			.dashboard()
			.then((d) => {
				recentActivities = d.recent;
				upcomingActivities = d.upcoming;
			})
			.catch(() => {
				error = 'ไม่สามารถโหลดกิจกรรมได้';
			})
			.finally(() => {
				loadingActivities = false;
			});

		// Fetch participation history
		activitiesApi
			.myParticipations()
			.then((data) => {
				participations = data;
			})
			.catch(() => {
				// non-critical, ignore
			})
			.finally(() => {
				loadingParticipations = false;
			});
	});

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActivityBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
		switch (type) {
			case 'lecture':
				return 'default';
			case 'workshop':
				return 'secondary';
			case 'exam':
				return 'outline';
			default:
				return 'outline';
		}
	}

	function getParticipationStatusLabel(status: string): string {
		switch (status) {
			case 'registered':
				return 'ลงทะเบียนแล้ว';
			case 'checked_in':
				return 'เช็คอินแล้ว';
			case 'checked_out':
				return 'เช็คเอาท์';
			case 'completed':
				return 'เสร็จสิ้น';
			case 'cancelled':
				return 'ยกเลิก';
			case 'no_show':
				return 'ไม่เข้าร่วม';
			default:
				return status;
		}
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
		switch (status) {
			case 'completed':
				return 'default';
			case 'checked_in':
				return 'secondary';
			default:
				return 'outline';
		}
	}
</script>

<div class="space-y-6">
	<!-- Welcome Card -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconUsers class="size-5" />
				ยินดีต้อนรับ, {authStore.user?.first_name}!
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">
					รหัสนักศึกษา: <span class="font-medium">{authStore.user?.student_id}</span>
				</p>
				<p class="text-sm text-muted-foreground">
					อีเมล: <span class="font-medium">{authStore.user?.email}</span>
				</p>
				<div class="flex gap-2 pt-2">
					<Button size="sm" href="/student/qr">
						<IconQrcode class="mr-2 size-4" />
						ดู QR Code
					</Button>
					<Button size="sm" variant="outline" href="/student/activities">
						<IconCalendarEvent class="mr-2 size-4" />
						กิจกรรมของฉัน
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Statistics Section -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">การเข้าร่วมทั้งหมด</CardTitle>
				<IconTrendingUp class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{#if loadingParticipations}
					<Skeleton class="h-8 w-12" />
				{:else}
					<div class="text-2xl font-bold">{totalParticipations}</div>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">กิจกรรมที่เข้าร่วม</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เดือนนี้</CardTitle>
				<IconCalendarEvent class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{#if loadingParticipations}
					<Skeleton class="h-8 w-12" />
				{:else}
					<div class="text-2xl font-bold">{thisMonthParticipations}</div>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">กิจกรรมในเดือนนี้</p>
			</CardContent>
		</Card>

		<Card class="col-span-2 md:col-span-1">
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">กิจกรรมที่กำลังจะมา</CardTitle>
				<IconClock class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{#if loadingActivities}
					<Skeleton class="h-8 w-12" />
				{:else}
					<div class="text-2xl font-bold">{upcomingCount}</div>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">กิจกรรมที่เปิดรับสมัคร</p>
			</CardContent>
		</Card>
	</div>

	<!-- Recent Activities and History -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Recent Activities -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconCalendarEvent class="size-5" />
						กิจกรรมล่าสุด
					</span>
					<Button size="sm" variant="outline" href="/student/activities">
						ดูทั้งหมด
						<IconChevronRight class="ml-1 size-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if error}
					<Alert variant="destructive">
						<IconAlertCircle class="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{:else if loadingActivities}
					<div class="space-y-3">
						{#each Array(3) as _}
							<div class="space-y-2">
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-3 w-1/2" />
								<Skeleton class="h-3 w-full" />
							</div>
						{/each}
					</div>
				{:else if recentActivities.length === 0}
					<div class="py-8 text-center text-muted-foreground">
						<div
							class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted"
						>
							<IconCalendarEvent class="size-6 opacity-60" />
						</div>
						<p class="font-medium">ยังไม่มีกิจกรรม</p>
						<p class="mt-1 text-sm text-muted-foreground">
							กิจกรรมใหม่จะปรากฏที่นี่เมื่อมีการเพิ่ม
						</p>
						<Button class="mt-3" size="sm" href="/student/activities">
							<IconCalendarEvent class="mr-2 size-4" />
							ดูกิจกรรมทั้งหมด
						</Button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each recentActivities as activity}
							<div class="space-y-2 rounded-lg border p-3">
								<div class="flex items-start justify-between">
									<h4 class="text-sm font-medium">{activity.title}</h4>
									<Badge variant={getActivityBadgeVariant(activity.activity_type)}>
										{getActivityTypeDisplayName(activity.activity_type)}
									</Badge>
								</div>

								{#if activity.description}
									<p class="line-clamp-2 text-xs text-muted-foreground">
										{activity.description}
									</p>
								{/if}

								<div class="flex items-center gap-4 text-xs text-muted-foreground">
									<span class="flex items-center gap-1">
										<IconClock class="size-3" />
										{formatDate(activity.start_date)}
									</span>
									{#if activity.location}
										<span class="flex items-center gap-1">
											<IconMapPin class="size-3" />
											{activity.location}
										</span>
									{/if}
									{#if activity.max_participants}
										<span class="flex items-center gap-1">
											<IconUsers class="size-3" />
											{activity.max_participants} คน
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Participation History -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconHistory class="size-5" />
						ประวัติการเข้าร่วม
					</span>
					<Button size="sm" variant="outline" href="/student/history">
						ดูทั้งหมด
						<IconChevronRight class="ml-1 size-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loadingParticipations}
					<div class="space-y-3">
						{#each Array(3) as _}
							<div class="space-y-2">
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-3 w-1/2" />
							</div>
						{/each}
					</div>
				{:else if participations.length === 0}
					<div class="py-8 text-center text-muted-foreground">
						<div
							class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted"
						>
							<IconHistory class="size-6 opacity-60" />
						</div>
						<p class="font-medium">ยังไม่มีประวัติการเข้าร่วม</p>
						<p class="mt-1 text-sm text-muted-foreground">
							เมื่อคุณเข้าร่วมกิจกรรมแล้ว ประวัติจะแสดงที่นี่
						</p>
						<Button class="mt-3" size="sm" href="/student/activities">
							<IconCalendarEvent class="mr-2 size-4" />
							ดูกิจกรรม
						</Button>
					</div>
				{:else}
					<div class="space-y-3">
						{#each participations.slice(0, 5) as participation}
							<div class="space-y-2 rounded-lg border p-3">
								<div class="flex items-start justify-between gap-2">
									<h4 class="text-sm font-medium">
										{participation.activity?.title}
									</h4>
									<Badge variant={getStatusVariant(participation.status)} class="shrink-0">
										{getParticipationStatusLabel(participation.status)}
									</Badge>
								</div>
								<div class="flex items-center gap-4 text-xs text-muted-foreground">
									{#if participation.registered_at}
										<span class="flex items-center gap-1">
											<IconClock class="size-3" />
											{formatDate(participation.registered_at)}
										</span>
									{/if}
									{#if participation.activity?.location}
										<span class="flex items-center gap-1">
											<IconMapPin class="size-3" />
											{participation.activity.location}
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Quick Actions -->
	<Card>
		<CardHeader>
			<CardTitle>การดำเนินการด่วน</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid gap-3 md:grid-cols-3">
				<Button href="/student/qr" class="justify-start">
					<IconQrcode class="mr-2 size-4" />
					ดู QR Code ของฉัน
				</Button>
				<Button href="/student/activities" variant="outline" class="justify-start">
					<IconCalendarEvent class="mr-2 size-4" />
					ดูกิจกรรมทั้งหมด
				</Button>
				<Button href="/student/profile" variant="outline" class="justify-start">
					<IconUsers class="mr-2 size-4" />
					แก้ไขโปรไฟล์
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
