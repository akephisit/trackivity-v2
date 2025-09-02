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

let { data } = $props<{ data: { history: any[] } }>();
let participationHistory: any[] = $state(data?.history || []);
let filteredHistory: any[] = $state([]);
let loading = $state(true);
let error: string | null = $state(null);
	let searchQuery = $state('');
	let sortBy = $state('recent'); // recent, oldest, activity_name, duration
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

// Initialize from server data
loading = false;
filteredHistory = participationHistory;
calculateStats(participationHistory);

	function calculateStats(data: any[]) {
		const now = new Date();
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const thisYear = new Date(now.getFullYear(), 0, 1);

		// Remove duplicates for accurate statistics (keep most recent participation per activity)
		const uniqueActivities = new Map();
		data.forEach((p) => {
			const activityId = p.activity?.id;
			if (activityId) {
				const existing = uniqueActivities.get(activityId);
				if (!existing || new Date(p.participated_at) > new Date(existing.participated_at)) {
					uniqueActivities.set(activityId, p);
				}
			}
		});
		const uniqueData = Array.from(uniqueActivities.values());

		const completedActivities = uniqueData.filter((p) => p.status === 'completed' || p.status === 'checked_out');
		
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
			thisMonth: data.filter((p) => new Date(p.participated_at) >= thisMonth).length,
			thisYear: data.filter((p) => new Date(p.participated_at) >= thisYear).length,
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
			if (activityId) {
				const existingParticipation = activityMap.get(activityId);
				if (!existingParticipation || new Date(p.participated_at) > new Date(existingParticipation.participated_at)) {
					activityMap.set(activityId, p);
				}
			}
		});
		filtered = Array.from(activityMap.values());

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
        filtered = filtered.filter((p) => {
            const name = (p.activity?.name || (p as any).activity?.title || '').toLowerCase();
            const desc = (p.activity?.description || '').toLowerCase();
            return name.includes(query) || desc.includes(query);
        });
		}

		// Time and status filter
		const now = new Date();
		switch (filterBy) {
			case 'this_month': {
				const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				filtered = filtered.filter((p) => new Date(p.participated_at) >= thisMonth);
				break;
			}
			case 'last_month': {
				const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				filtered = filtered.filter((p) => {
					const date = new Date(p.participated_at);
					return date >= lastMonth && date < thisMonth;
				});
				break;
			}
			case 'this_year': {
				const thisYear = new Date(now.getFullYear(), 0, 1);
				filtered = filtered.filter((p) => new Date(p.participated_at) >= thisYear);
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
					(a, b) => new Date(b.participated_at).getTime() - new Date(a.participated_at).getTime()
				);
				break;
			case 'oldest':
				filtered.sort(
					(a, b) => new Date(a.participated_at).getTime() - new Date(b.participated_at).getTime()
				);
				break;
			case 'activity_name':
				filtered.sort((a, b) => (a.activity?.name || '').localeCompare(b.activity?.name || ''));
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

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
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
	<title>ประวัติการเข้าร่วม - Trackivity Student</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold lg:text-3xl">ประวัติการเข้าร่วม</h1>
		<p class="text-muted-foreground">ดูประวัติการเข้าร่วมกิจกรรมทั้งหมดของคุณ</p>
	</div>

	<!-- Statistics -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ทั้งหมด</CardTitle>
				<IconTrendingUp class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.total}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมที่เข้าร่วม</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เสร็จสิ้น</CardTitle>
				<IconCheck class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.completedActivities}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมที่เสร็จสิ้น</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เดือนนี้</CardTitle>
				<IconCalendarEvent class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.thisMonth}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมในเดือนนี้</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ปีนี้</CardTitle>
				<IconAward class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.thisYear}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมในปีนี้</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ไม่ซ้ำ</CardTitle>
				<IconHistory class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.uniqueActivities}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมที่แตกต่าง</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">รวมชั่วโมง</CardTitle>
				<IconHourglass class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.totalHours}</div>
				<p class="text-xs text-muted-foreground">ชั่วโมงจากกิจกรรม</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ชั่วโมงคณะ</CardTitle>
				<IconSchool class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.facultyHours}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมระดับคณะ</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ชั่วโมงมหาวิทยาลัย</CardTitle>
				<IconBuilding class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.universityHours}</div>
				<p class="text-xs text-muted-foreground">กิจกรรมระดับมหาวิทยาลัย</p>
			</CardContent>
		</Card>
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
				<option value="activity_name">ชื่อกิจกรรม</option>
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
					<Card class="transition-shadow hover:shadow-md">
						<CardContent class="p-4">
							<div class="space-y-4">
								<!-- Header -->
								<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
									<div class="space-y-2">
										<div class="flex items-start gap-3">
											<div class="mt-1">
												<StatusIcon class="size-5 text-muted-foreground" />
											</div>
											<div class="space-y-1 flex-1">
												<h3 class="text-base font-medium leading-tight">
													{participation.activity?.name || participation.activity?.title || 'ไม่ระบุชื่อกิจกรรม'}
												</h3>
												{#if participation.activity?.description}
													<p class="line-clamp-2 text-sm text-muted-foreground">
														{participation.activity.description}
													</p>
												{/if}
												{#if participation.activity?.organizer_name}
													<div class="flex items-center gap-1 text-xs text-muted-foreground">
														<IconBuildingStore class="size-3" />
														<span>{participation.activity.organizer_name}</span>
													</div>
												{/if}
											</div>
										</div>
									</div>
									<div class="flex flex-wrap gap-2 sm:flex-col sm:items-end">
										<Badge variant={getStatusBadgeVariant(participation.status)}>
											{getParticipationStatusText(participation.status)}
										</Badge>
										{#if participation.activity?.activity_level}
											{@const LevelIcon = getActivityLevelIcon(participation.activity.activity_level)}
											<Badge variant={getActivityLevelBadgeVariant(participation.activity.activity_level)} class="gap-1">
												<LevelIcon class="size-3" />
												{getActivityLevelDisplayName(participation.activity.activity_level)}
											</Badge>
										{/if}
										{#if participation.activity?.activity_type}
											<Badge variant={getActivityBadgeVariant(participation.activity.activity_type)}>
												{getActivityTypeDisplayName(participation.activity.activity_type)}
											</Badge>
										{/if}
									</div>
								</div>

								<!-- Timeline Details -->
								<div class="border-l-2 border-muted pl-4 space-y-3">
									<!-- Activity Schedule -->
									<div class="grid grid-cols-1 gap-2 text-sm">
										{#if participation.activity?.start_date}
											<div class="flex items-center gap-2 text-muted-foreground">
												<IconCalendarEvent class="size-4 flex-shrink-0" />
												<span>กำหนดการ: {formatDate(participation.activity.start_date)}</span>
												{#if participation.activity.start_time}
													<span>- {participation.activity.start_time}</span>
												{/if}
											</div>
										{/if}
										
										{#if participation.activity?.location}
											<div class="flex items-center gap-2 text-muted-foreground">
												<IconMapPin class="size-4 flex-shrink-0" />
												<span class="truncate">สถานที่: {participation.activity.location}</span>
											</div>
										{/if}
									</div>

									<!-- Participation Timeline -->
									<div class="space-y-2">
										{#if participation.registered_at}
											<div class="flex items-center gap-2 text-sm text-muted-foreground">
												<IconUserCheck class="size-4 flex-shrink-0" />
												<span>ลงทะเบียน: {formatDateShort(participation.registered_at)}</span>
											</div>
										{/if}
										
										{#if participation.checked_in_at}
											<div class="flex items-center gap-2 text-sm text-muted-foreground">
												<IconLogin class="size-4 flex-shrink-0" />
												<span>เช็คอิน: {formatDateShort(participation.checked_in_at)}</span>
											</div>
										{/if}
										
										{#if participation.checked_out_at}
											<div class="flex items-center gap-2 text-sm text-muted-foreground">
												<IconLogout class="size-4 flex-shrink-0" />
												<span>เช็คเอาท์: {formatDateShort(participation.checked_out_at)}</span>
											</div>
										{/if}


										{#if participation.activity?.hours}
											<div class="flex items-center gap-2 text-sm text-muted-foreground">
												<IconHourglass class="size-4 flex-shrink-0" />
												<span>จำนวนชั่วโมงที่ได้: {participation.activity.hours} ชั่วโมง</span>
											</div>
										{/if}
									</div>

									<!-- Notes -->
									{#if participation.notes}
										<div class="pt-2 border-t text-sm">
											<p class="text-muted-foreground">หมายเหตุ:</p>
											<p class="text-foreground">{participation.notes}</p>
										</div>
									{/if}
								</div>
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

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
