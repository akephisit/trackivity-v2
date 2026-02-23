<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import {
		IconHistory,
		IconCalendarEvent,
		IconMapPin,
		IconSearch,
		IconAlertCircle,
		IconTrendingUp,
		IconAward,
		IconLogin,
		IconLogout,
		IconUserCheck,
		IconHourglass,
		IconBuildingStore,
		IconCheck,
		IconX,
		IconClock2,
		IconSchool,
		IconBuilding
	} from '@tabler/icons-svelte';
	import { getActivityLevelDisplayName, getActivityTypeDisplayName } from '$lib/utils/activity';

	import { activitiesApi, ApiError } from '$lib/api';
	import { onMount } from 'svelte';

	let participationHistory: any[] = $state([]);
	let filteredHistory: any[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);
	let searchQuery = $state('');
	let sortBy = $state('recent'); // recent, oldest, title, duration
	let filterBy = $state('all'); // all, this_month, last_month, this_year, completed, in_progress

	// Stats
	let stats = $state({
		total: 0,
		thisMonth: 0,
		thisYear: 0,
		uniqueActivities: 0,
		totalHours: 0,
		facultyHours: 0,
		universityHours: 0,
		completedActivities: 0,
		facultyActivities: 0,
		universityActivities: 0
	});

	onMount(async () => {
		try {
			const data = await activitiesApi.myParticipations();
			participationHistory = data;
			filteredHistory = data;
			calculateStats(data);
		} catch (e) {
			if (e instanceof ApiError) {
				error = `ไม่สามารถโหลดประวัติได้: ${e.message}`;
			} else {
				error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
			}
		} finally {
			loading = false;
		}
	});

	function calculateStats(data: any[]) {
		const now = new Date();
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const thisYear = new Date(now.getFullYear(), 0, 1);

		// Remove duplicates for accurate statistics (keep most recent participation per activity)
		const uniqueActivities = new Map();
		data.forEach((p) => {
			const activityId = p.activity?.id;
			const pDate = p.checked_in_at || p.registered_at || new Date().toISOString();
			if (activityId) {
				const existing = uniqueActivities.get(activityId);
				const existingDate = existing ? existing.checked_in_at || existing.registered_at : null;
				if (!existing || new Date(pDate) > new Date(existingDate)) {
					uniqueActivities.set(activityId, p);
				}
			}
		});
		const uniqueData = Array.from(uniqueActivities.values());

		const completedActivities = uniqueData.filter(
			(p) => p.status === 'completed' || p.status === 'checked_out'
		);

		// Calculate hours by activity level
		let totalHours = 0;
		let facultyHours = 0;
		let universityHours = 0;
		let facultyActivities = 0;
		let universityActivities = 0;

		uniqueData.forEach((p) => {
			if (p.activity?.hours && (p.status === 'completed' || p.status === 'checked_out')) {
				const hours = p.activity.hours || 0;
				totalHours += hours;

				if (p.activity.activity_level === 'faculty') {
					facultyHours += hours;
					facultyActivities++;
				} else if (p.activity.activity_level === 'university') {
					universityHours += hours;
					universityActivities++;
				}
			}
		});

		stats = {
			total: data.length,
			thisMonth: data.filter((p) => new Date(p.checked_in_at || p.registered_at) >= thisMonth)
				.length,
			thisYear: data.filter((p) => new Date(p.checked_in_at || p.registered_at) >= thisYear).length,
			uniqueActivities: uniqueActivities.size,
			totalHours,
			facultyHours,
			universityHours,
			completedActivities: completedActivities.length,
			facultyActivities,
			universityActivities
		};
	}

	function filterAndSortHistory() {
		let filtered = participationHistory;

		// Deduplication: Remove duplicate activities (keep the most recent participation for each activity)
		const activityMap = new Map();
		filtered.forEach((p) => {
			const activityId = p.activity?.id;
			const pDate = p.checked_in_at || p.registered_at || new Date().toISOString();
			if (activityId) {
				const existingParticipation = activityMap.get(activityId);
				const existingDate = existingParticipation
					? existingParticipation.checked_in_at || existingParticipation.registered_at
					: null;
				if (!existingParticipation || new Date(pDate) > new Date(existingDate)) {
					activityMap.set(activityId, p);
				}
			}
		});
		filtered = Array.from(activityMap.values());

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((p) => {
				const name = (p.activity?.title || '').toLowerCase();
				const desc = (p.activity?.description || '').toLowerCase();
				return name.includes(query) || desc.includes(query);
			});
		}

		// Time and status filter
		const now = new Date();
		switch (filterBy) {
			case 'this_month': {
				const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				filtered = filtered.filter(
					(p) => new Date(p.checked_in_at || p.registered_at) >= thisMonth
				);
				break;
			}
			case 'last_month': {
				const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				filtered = filtered.filter((p) => {
					const date = new Date(p.checked_in_at || p.registered_at);
					return date >= lastMonth && date < thisMonth;
				});
				break;
			}
			case 'this_year': {
				const thisYear = new Date(now.getFullYear(), 0, 1);
				filtered = filtered.filter((p) => new Date(p.checked_in_at || p.registered_at) >= thisYear);
				break;
			}
			case 'completed': {
				filtered = filtered.filter((p) => p.status === 'completed' || p.status === 'checked_out');
				break;
			}
			case 'in_progress': {
				filtered = filtered.filter((p) => p.status === 'registered' || p.status === 'checked_in');
				break;
			}
		}

		// Sort
		switch (sortBy) {
			case 'recent':
				filtered.sort(
					(a, b) =>
						new Date(b.checked_in_at || b.registered_at).getTime() -
						new Date(a.checked_in_at || a.registered_at).getTime()
				);
				break;
			case 'oldest':
				filtered.sort(
					(a, b) =>
						new Date(a.checked_in_at || a.registered_at).getTime() -
						new Date(b.checked_in_at || b.registered_at).getTime()
				);
				break;
			case 'title':
				filtered.sort((a, b) => (a.activity?.title || '').localeCompare(b.activity?.title || ''));
				break;
			case 'duration':
				filtered.sort((a, b) => {
					const aDuration = a.participation_duration_minutes || 0;
					const bDuration = b.participation_duration_minutes || 0;
					return bDuration - aDuration;
				});
				break;
		}

		filteredHistory = filtered;
	}

	// Reactive filtering
	$effect(() => {
		filterAndSortHistory();
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

	function formatDateShort(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActivityBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
		switch (type) {
			case 'Academic':
				return 'default';
			case 'Sports':
				return 'secondary';
			case 'Cultural':
				return 'outline';
			case 'Social':
				return 'outline';
			default:
				return 'outline';
		}
	}

	function getActivityLevelBadgeVariant(level: string): 'default' | 'secondary' | 'outline' {
		switch (level) {
			case 'university':
				return 'default';
			case 'faculty':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function getActivityLevelIcon(level: string) {
		switch (level) {
			case 'university':
				return IconBuilding;
			case 'faculty':
				return IconSchool;
			default:
				return IconBuildingStore;
		}
	}

	function getParticipationStatusText(status: string): string {
		const statusMap: Record<string, string> = {
			registered: 'ลงทะเบียน',
			checked_in: 'เช็คอิน',
			checked_out: 'เช็คเอาท์',
			completed: 'เสร็จสิ้น',
			no_show: 'ไม่เข้าร่วม'
		};
		return statusMap[status] || status;
	}

	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'outline' | 'destructive' {
		switch (status) {
			case 'completed':
			case 'checked_out':
				return 'default';
			case 'checked_in':
				return 'secondary';
			case 'registered':
				return 'outline';
			case 'no_show':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'completed':
			case 'checked_out':
				return IconCheck;
			case 'checked_in':
				return IconLogin;
			case 'registered':
				return IconUserCheck;
			case 'no_show':
				return IconX;
			default:
				return IconClock2;
		}
	}
</script>

<svelte:head>
	<title>ประวัติการเข้าร่วม - Trackivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold lg:text-3xl">ประวัติการเข้าร่วม</h1>
		<p class="text-muted-foreground">ดูประวัติการเข้าร่วมกิจกรรมทั้งหมดของคุณ</p>
	</div>

	<!-- Statistics -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<div
			class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
		>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
				<IconTrendingUp class="size-5 text-primary" />
			</div>
			<div>
				<p class="text-2xl leading-none font-bold tracking-tight">{stats.total}</p>
				<p class="mt-1 text-xs font-medium text-muted-foreground">รายการเข้าร่วม</p>
			</div>
		</div>

		<div
			class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
		>
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
			>
				<IconCheck class="size-5 text-green-600 dark:text-green-500" />
			</div>
			<div>
				<p
					class="text-2xl leading-none font-bold tracking-tight text-green-600 dark:text-green-500"
				>
					{stats.completedActivities}
				</p>
				<p class="mt-1 text-xs font-medium text-muted-foreground">กิจกรรมที่เสร็จสิ้น</p>
			</div>
		</div>

		<div
			class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
		>
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
			>
				<IconCalendarEvent class="size-5 text-blue-600 dark:text-blue-500" />
			</div>
			<div>
				<p class="text-2xl leading-none font-bold tracking-tight text-blue-600 dark:text-blue-500">
					{stats.thisMonth}
				</p>
				<p class="mt-1 text-xs font-medium text-muted-foreground">รายการเดือนนี้</p>
			</div>
		</div>

		<div
			class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
		>
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
			>
				<IconHourglass class="size-5 text-orange-600 dark:text-orange-500" />
			</div>
			<div>
				<p
					class="text-2xl leading-none font-bold tracking-tight text-orange-600 dark:text-orange-500"
				>
					{stats.totalHours}
				</p>
				<p class="mt-1 text-xs font-medium text-muted-foreground">ชั่วโมงสะสม</p>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="space-y-4">
		<!-- Search -->
		<div class="relative">
			<IconSearch
				class="absolute top-1/2 left-3 size-4 -translate-y-1/2 transform text-muted-foreground"
			/>
			<Input bind:value={searchQuery} placeholder="ค้นหากิจกรรม..." class="pl-9" />
		</div>

		<!-- Sort and Filter Controls -->
		<div class="flex flex-col gap-3 sm:flex-row">
			<select
				bind:value={sortBy}
				class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-[200px]"
			>
				<option value="recent">ล่าสุดก่อน</option>
				<option value="oldest">เก่าก่อน</option>
				<option value="title">ชื่อกิจกรรม</option>
				<option value="duration">ระยะเวลาเข้าร่วม</option>
			</select>

			<select
				bind:value={filterBy}
				class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-[200px]"
			>
				<option value="all">ทั้งหมด</option>
				<option value="completed">เสร็จสิ้นแล้ว</option>
				<option value="in_progress">กำลังดำเนินการ</option>
				<option value="this_month">เดือนนี้</option>
				<option value="last_month">เดือนที่แล้ว</option>
				<option value="this_year">ปีนี้</option>
			</select>
		</div>
	</div>

	<!-- History List -->
	<div>
		{#if error}
			<Alert variant="destructive">
				<IconAlertCircle class="size-4" />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{:else if loading}
			<div class="space-y-4">
				{#each Array(5) as _}
					<Card>
						<CardContent class="p-4">
							<div class="space-y-2">
								<div class="flex items-start justify-between">
									<Skeleton class="h-4 w-3/4" />
									<Skeleton class="h-5 w-16" />
								</div>
								<Skeleton class="h-3 w-1/2" />
								<Skeleton class="h-3 w-full" />
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{:else if filteredHistory.length === 0}
			<div class="py-12 text-center">
				<IconHistory class="mx-auto mb-4 size-12 text-muted-foreground/50" />
				<h3 class="mb-2 text-lg font-medium">ไม่มีประวัติการเข้าร่วม</h3>
				<p class="mx-auto max-w-md text-muted-foreground">
					{searchQuery || filterBy !== 'all'
						? 'ไม่พบประวัติที่ตรงกับเงื่อนไขที่กำหนด ลองเปลี่ยนการค้นหาหรือตัวกรอง'
						: 'เมื่อคุณเข้าร่วมกิจกรรม ประวัติจะแสดงที่นี่'}
				</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each filteredHistory as participation}
					{@const StatusIcon = getStatusIcon(participation.status)}
					{@const levelVariant = participation.activity?.activity_level
						? getActivityLevelBadgeVariant(participation.activity.activity_level)
						: 'outline'}
					{@const LevelIcon = participation.activity?.activity_level
						? getActivityLevelIcon(participation.activity.activity_level)
						: IconBuildingStore}
					{@const borderClasses =
						levelVariant === 'secondary'
							? 'border-l-4 border-l-green-500'
							: levelVariant === 'default'
								? 'border-l-4 border-l-blue-500'
								: 'border-l-4 border-l-muted'}

					<Card class={`transition-all hover:-translate-y-0.5 hover:shadow-md ${borderClasses}`}>
						<CardContent class="p-4 pb-3.5">
							<div class="flex flex-col gap-2.5">
								<!-- Header Area (Title & Badges) -->
								<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
									<div class="flex-1 space-y-1.5">
										<div class="mb-1 flex flex-wrap items-center gap-2">
											<Badge
												variant={getStatusBadgeVariant(participation.status)}
												class="px-2.5 py-0.5"
											>
												<StatusIcon class="mr-1.5 size-3.5" />
												{getParticipationStatusText(participation.status)}
											</Badge>

											{#if participation.activity?.activity_level}
												<Badge
													variant={levelVariant}
													class="gap-1 border bg-background px-2 shadow-sm"
												>
													<LevelIcon class="size-3" />
													{getActivityLevelDisplayName(participation.activity.activity_level)}
												</Badge>
											{/if}

											{#if participation.activity?.activity_type}
												<Badge variant="outline" class="px-2 text-muted-foreground">
													{getActivityTypeDisplayName(participation.activity.activity_type)}
												</Badge>
											{/if}
										</div>

										<h3 class="text-base leading-tight font-bold text-foreground">
											{participation.activity?.title || 'ไม่ระบุชื่อกิจกรรม'}
										</h3>

										{#if participation.activity?.organizer_name}
											<div class="flex items-center gap-1.5 text-sm font-medium text-primary/80">
												<IconBuildingStore class="size-4" />
												<span>{participation.activity.organizer_name}</span>
											</div>
										{/if}
									</div>

									{#if participation.activity?.hours}
										<div
											class="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm font-semibold text-foreground"
										>
											<IconHourglass class="size-4 text-orange-500" />
											<span class="text-base">{participation.activity.hours}</span> ชั่วโมง
										</div>
									{/if}
								</div>

								<!-- Timeline Details -->
								<div
									class="mt-0.5 grid gap-x-6 gap-y-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2"
								>
									<div class="space-y-2">
										{#if participation.activity?.start_date}
											<div class="flex items-start gap-2 text-sm">
												<IconCalendarEvent class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
												<div class="grid gap-0.5">
													<span
														class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
														>กำหนดการ</span
													>
													<span class="font-medium text-foreground">
														{formatDate(participation.activity.start_date)}
														{#if participation.activity.start_time}
															- {participation.activity.start_time}
														{/if}
													</span>
												</div>
											</div>
										{/if}

										{#if participation.activity?.location}
											<div class="flex items-start gap-2 text-sm">
												<IconMapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
												<div class="grid gap-0.5">
													<span
														class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
														>สถานที่จัดกิจกรรม</span
													>
													<span class="text-foreground">{participation.activity.location}</span>
												</div>
											</div>
										{/if}
									</div>

									<div class="space-y-2">
										<div class="flex items-start gap-2 text-sm">
											<IconHistory class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
											<div class="grid w-full gap-1">
												<span
													class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
													>ประวัติการบันทึกเวลา</span
												>

												<div class="mt-0.5 space-y-1.5">
													{#if participation.registered_at}
														<div
															class="flex items-center justify-between rounded-md border bg-background px-2 py-1 text-xs"
														>
															<span class="flex items-center gap-1 text-muted-foreground"
																><IconUserCheck class="size-3" /> ลงทะเบียน</span
															>
															<span class="font-medium"
																>{formatDateShort(participation.registered_at)}</span
															>
														</div>
													{/if}
													{#if participation.checked_in_at}
														<div
															class="flex items-center justify-between rounded-md border border-green-100 bg-green-50/50 px-2 py-1 text-xs dark:border-green-900 dark:bg-green-950/20"
														>
															<span
																class="flex items-center gap-1 text-green-600 dark:text-green-500"
																><IconLogin class="size-3" /> เข้าร่วม (เช็คอิน)</span
															>
															<span class="font-medium"
																>{formatDateShort(participation.checked_in_at)}</span
															>
														</div>
													{/if}
													{#if participation.checked_out_at}
														<div
															class="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50/50 px-2 py-1 text-xs dark:border-blue-900 dark:bg-blue-950/20"
														>
															<span class="flex items-center gap-1 text-blue-600 dark:text-blue-500"
																><IconLogout class="size-3" /> เสร็จสิ้น (เช็คเอาท์)</span
															>
															<span class="font-medium"
																>{formatDateShort(participation.checked_out_at)}</span
															>
														</div>
													{/if}
												</div>
											</div>
										</div>
									</div>
								</div>

								<!-- Notes -->
								{#if participation.notes}
									<div
										class="flex gap-2 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2 text-sm dark:border-orange-900/30 dark:bg-orange-950/20"
									>
										<IconAlertCircle class="mt-0.5 size-4 shrink-0 text-orange-500" />
										<div>
											<span class="font-medium text-orange-700 dark:text-orange-400">หมายเหตุ:</span
											>
											<span class="ml-1 text-muted-foreground">{participation.notes}</span>
										</div>
									</div>
								{/if}
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>

			<!-- Results Summary -->
			<div class="text-center text-sm text-muted-foreground">
				แสดง {filteredHistory.length} รายการ
				{#if filteredHistory.length !== participationHistory.length}
					จากทั้งหมด {participationHistory.length} รายการ
				{/if}
			</div>
		{/if}
	</div>
</div>
