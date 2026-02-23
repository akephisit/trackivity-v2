<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activitiesApi, type Activity, type Participation } from '$lib/api';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { getPrefixLabel } from '$lib/schemas/auth';
	import { getDailyGreeting } from '$lib/utils/greeting';
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
		IconAlertCircle,
		IconCheck
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

	const greeting = $derived(
		authStore.user
			? getDailyGreeting(
					getPrefixLabel(authStore.user.prefix) + authStore.user.first_name,
					'student'
				)
			: { greeting: 'สวัสดี!', subtitle: 'ติดตามกิจกรรมและผลงานของคุณได้ที่นี่' }
	);

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

<div class="space-y-6 pb-10">
	<!-- Hero Section (Welcome) -->
	<div
		class="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 shadow-sm sm:p-10 md:flex-row md:items-center"
	>
		<div class="relative z-10 flex max-w-2xl flex-col gap-3">
			<div
				class="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
			>
				<IconUsers class="size-4" />
				นักศึกษา
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
				{greeting.greeting}
			</h1>
			<p class="text-base text-muted-foreground lg:text-lg">
				{greeting.subtitle}
			</p>
			{#if authStore.user}
				<div
					class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-foreground/80"
				>
					<div class="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1">
						<span class="text-muted-foreground">รหัสนักศึกษา:</span>
						<span>{authStore.user.student_id}</span>
					</div>
					<div class="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1">
						<span class="text-muted-foreground">อีเมล:</span>
						<span>{authStore.user.email}</span>
					</div>
				</div>
			{/if}
			<div class="flex flex-wrap gap-3 pt-4">
				<Button size="lg" href="/student/qr" class="rounded-full px-6 shadow-sm">
					<IconQrcode class="mr-2 size-5" />
					บัตรคิวอาร์ (ID Pass)
				</Button>
				<Button
					size="lg"
					variant="outline"
					href="/student/activities"
					class="rounded-full bg-background/50 px-6 backdrop-blur-sm"
				>
					<IconCalendarEvent class="mr-2 size-5" />
					หากิจกรรม
				</Button>
			</div>
		</div>

		<!-- Decorative Abstract Art for Hero -->
		<div
			class="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-primary/10 blur-[60px]"
		></div>
		<div
			class="pointer-events-none absolute -bottom-10 -left-10 size-40 rounded-full bg-primary/5 blur-3xl"
		></div>
	</div>

	<!-- Statistics Section (Bento Grid) -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<!-- Total Participations -->
		<Card
			class="col-span-2 border-none bg-gradient-to-b from-blue-500/10 to-transparent shadow-sm lg:col-span-1"
		>
			<CardHeader class="flex flex-row items-center gap-3 space-y-0 pb-3">
				<div
					class="flex size-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400"
				>
					<IconTrendingUp class="size-5" />
				</div>
				<CardTitle class="text-[15px] font-semibold text-foreground/80">เข้าร่วมทั้งหมด</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loadingParticipations}
					<Skeleton class="h-10 w-20" />
				{:else}
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
							>{totalParticipations}</span
						>
						<span class="text-sm font-medium text-muted-foreground">ครั้ง</span>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- This Month -->
		<Card
			class="col-span-2 border-none bg-gradient-to-b from-emerald-500/10 to-transparent shadow-sm lg:col-span-1"
		>
			<CardHeader class="flex flex-row items-center gap-3 space-y-0 pb-3">
				<div
					class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
				>
					<IconCalendarEvent class="size-5" />
				</div>
				<CardTitle class="text-[15px] font-semibold text-foreground/80">เดือนนี้</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loadingParticipations}
					<Skeleton class="h-10 w-20" />
				{:else}
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
							>{thisMonthParticipations}</span
						>
						<span class="text-sm font-medium text-muted-foreground">กิจกรรม</span>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Upcoming Activities (Wider Card) -->
		<Card
			class="relative col-span-2 overflow-hidden border-none bg-gradient-to-b from-orange-500/10 to-transparent shadow-sm lg:col-span-2"
		>
			<div
				class="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-orange-500/5 to-transparent"
			></div>
			<CardHeader class="relative z-10 flex flex-row items-center justify-between space-y-0 pb-3">
				<div class="flex items-center gap-3">
					<div
						class="flex size-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400"
					>
						<IconClock class="size-5" />
					</div>
					<CardTitle class="text-[15px] font-semibold text-foreground/80"
						>กิจกรรมที่เปิดรับสมัคร</CardTitle
					>
				</div>
				<Button
					size="sm"
					variant="ghost"
					href="/student/activities"
					class="hidden hover:bg-orange-500/10 hover:text-orange-600 sm:flex"
				>
					ดูทั้งหมด <IconChevronRight class="ml-1 size-4" />
				</Button>
			</CardHeader>
			<CardContent class="relative z-10">
				{#if loadingActivities}
					<Skeleton class="h-10 w-full" />
				{:else}
					<div class="flex items-center justify-between">
						<div class="flex items-baseline gap-2">
							<span class="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400"
								>{upcomingCount}</span
							>
							<span class="text-sm font-medium text-muted-foreground">รายการ</span>
						</div>
						{#if upcomingCount > 0}
							<div class="flex -space-x-2">
								<!-- decorative overlapping circles -->
								<div
									class="size-8 rounded-full border-2 border-background bg-orange-200 dark:bg-orange-800"
								></div>
								<div
									class="size-8 rounded-full border-2 border-background bg-orange-300 dark:bg-orange-700"
								></div>
								<div
									class="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold"
								>
									+{upcomingCount}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Main Content Area -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Participation History -->
		<Card class="flex flex-col border-muted/60 shadow-sm">
			<CardHeader class="border-b border-muted/40 pb-4">
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2.5 text-lg font-bold">
						<div
							class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<IconHistory class="size-4.5" />
						</div>
						ประวัติการเข้าร่วมล่าสุด
					</span>
					<Button
						size="sm"
						variant="ghost"
						href="/student/history"
						class="text-muted-foreground hover:text-primary"
					>
						ดูทั้งหมด
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent class="flex-1 pt-4">
				{#if loadingParticipations}
					<div class="space-y-4">
						{#each Array(3) as _}
							<div class="flex gap-3">
								<Skeleton class="size-10 shrink-0 rounded-full" />
								<div class="flex-1 space-y-2">
									<Skeleton class="h-4 w-3/4" />
									<Skeleton class="h-3 w-1/2" />
								</div>
							</div>
						{/each}
					</div>
				{:else if participations.length === 0}
					<div
						class="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground"
					>
						<div
							class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted shadow-inner"
						>
							<IconHistory class="size-7 text-foreground opacity-50" />
						</div>
						<p class="font-semibold text-foreground/80">ยังไม่มีประวัติการเข้าร่วม</p>
						<p class="mt-1.5 max-w-[250px] text-[13px]">
							เมื่อคุณสแกนเข้าร่วมกิจกรรม ข้อมูลจะแสดงที่นี่
						</p>
						<Button
							class="mt-4 rounded-full"
							size="sm"
							href="/student/activities"
							variant="outline"
						>
							<IconCalendarEvent class="mr-2 size-4" /> หากิจกรรม
						</Button>
					</div>
				{:else}
					<div
						class="relative space-y-6 before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-muted/60"
					>
						{#each participations.slice(0, 5) as participation}
							<div class="relative flex items-start gap-4">
								<div
									class="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-background shadow-sm"
								>
									<IconCheck
										class="size-5 {participation.status === 'completed'
											? 'text-emerald-500'
											: 'text-primary/60'}"
									/>
								</div>
								<div class="flex-1 space-y-1.5 pt-1.5">
									<div class="flex items-start justify-between gap-2">
										<h4 class="text-[14.5px] leading-tight font-semibold text-foreground/90">
											{participation.activity?.title}
										</h4>
										<Badge
											variant={getStatusVariant(participation.status)}
											class="shrink-0 px-2 text-[10px] font-bold tracking-wider uppercase"
										>
											{getParticipationStatusLabel(participation.status)}
										</Badge>
									</div>
									<div
										class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-muted-foreground"
									>
										{#if participation.registered_at}
											<span class="flex items-center gap-1.5">
												<IconClock class="size-3.5 text-foreground/50" />
												{formatDate(participation.registered_at)}
											</span>
										{/if}
										{#if participation.activity?.location}
											<span class="flex items-center gap-1.5">
												<IconMapPin class="size-3.5 text-foreground/50" />
												{participation.activity.location}
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Upcoming / Recent Activities -->
		<Card class="flex flex-col border-muted/60 bg-muted/10 shadow-sm">
			<CardHeader class="border-b border-muted/40 pb-4">
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2.5 text-lg font-bold">
						<div
							class="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"
						>
							<IconCalendarEvent class="size-4.5" />
						</div>
						กิจกรรมใหม่ล่าสุด
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent class="flex-1 p-4 pt-4">
				{#if error}
					<Alert variant="destructive">
						<IconAlertCircle class="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{:else if loadingActivities}
					<div class="space-y-3">
						{#each Array(3) as _}
							<Skeleton class="h-24 w-full rounded-xl" />
						{/each}
					</div>
				{:else if recentActivities.length === 0}
					<div
						class="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground"
					>
						<div
							class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted shadow-inner"
						>
							<IconCalendarEvent class="size-7 text-foreground opacity-50" />
						</div>
						<p class="font-semibold text-foreground/80">ยังไม่มีกิจกรรมใหม่</p>
					</div>
				{:else}
					<div class="grid gap-3">
						{#each recentActivities.slice(0, 3) as activity}
							<a
								href="/student/activities/{activity.id}"
								class="group flex flex-col gap-2 rounded-xl border border-muted/60 bg-background p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
							>
								<div class="flex items-start justify-between gap-3">
									<h4
										class="line-clamp-2 text-[14.5px] leading-tight font-semibold transition-colors group-hover:text-primary"
									>
										{activity.title}
									</h4>
									<Badge
										variant={getActivityBadgeVariant(activity.activity_type)}
										class="shrink-0 text-[10px] font-bold"
									>
										{getActivityTypeDisplayName(activity.activity_type)}
									</Badge>
								</div>

								<div
									class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-[12px] font-medium text-muted-foreground"
								>
									<span class="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5">
										<IconClock class="size-3.5 shrink-0 text-primary/60" />
										<span class="truncate">{formatDate(activity.start_date)}</span>
									</span>
									{#if activity.max_participants}
										<span
											class="flex shrink-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5"
										>
											<IconUsers class="size-3.5 text-foreground/60" />
											{activity.max_participants}
										</span>
									{/if}
								</div>
							</a>
						{/each}

						<Button
							variant="ghost"
							href="/student/activities"
							class="mt-2 w-full text-sm font-medium text-muted-foreground hover:bg-muted"
						>
							ดูกิจกรรมทั้งหมด
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
