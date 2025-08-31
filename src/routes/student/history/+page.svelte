<script lang="ts">
    import type { ActivityParticipation } from '$lib/types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import {
		IconHistory,
		IconCalendarEvent,
		IconClock,
		IconMapPin,
		IconSearch,
		IconAlertCircle,
		IconTrendingUp,
		IconAward
	} from '@tabler/icons-svelte';

let { data } = $props<{ data: { history: ActivityParticipation[] } }>();
let participationHistory: ActivityParticipation[] = $state(data?.history || []);
let filteredHistory: ActivityParticipation[] = $state([]);
let loading = $state(true);
let error: string | null = $state(null);
	let searchQuery = $state('');
	let sortBy = $state('recent'); // recent, oldest, activity_name
	let filterBy = $state('all'); // all, this_month, last_month, this_year

	// Stats
	let stats = $state({
		total: 0,
		thisMonth: 0,
		thisYear: 0,
		uniqueActivities: 0
	});

// Initialize from server data
loading = false;
filteredHistory = participationHistory;
calculateStats(participationHistory);

	function calculateStats(data: ActivityParticipation[]) {
		const now = new Date();
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const thisYear = new Date(now.getFullYear(), 0, 1);

		stats = {
			total: data.length,
			thisMonth: data.filter((p) => new Date(p.participated_at) >= thisMonth).length,
			thisYear: data.filter((p) => new Date(p.participated_at) >= thisYear).length,
			uniqueActivities: new Set(data.map((p) => p.activity?.id)).size
		};
	}

	function filterAndSortHistory() {
		let filtered = participationHistory;

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
        filtered = filtered.filter((p) => {
            const name = (p.activity?.name || (p as any).activity?.title || '').toLowerCase();
            const desc = (p.activity?.description || '').toLowerCase();
            return name.includes(query) || desc.includes(query);
        });
		}

		// Time filter
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

	function getActivityTypeText(type: string): string {
		const types: Record<string, string> = {
			lecture: 'บรรยาย',
			workshop: 'ปฏิบัติการ',
			seminar: 'สัมมนา',
			exam: 'สอบ',
			meeting: 'ประชุม',
			event: 'งาน'
		};
		return types[type] || type;
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
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
				class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-[180px]"
			>
				<option value="recent">ล่าสุดก่อน</option>
				<option value="oldest">เก่าก่อน</option>
				<option value="activity_name">ชื่อกิจกรรม</option>
			</select>

			<select
				bind:value={filterBy}
				class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-[180px]"
			>
				<option value="all">ทั้งหมด</option>
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
					<Card class="transition-shadow hover:shadow-md">
						<CardContent class="p-4">
							<div class="space-y-3">
								<!-- Header -->
								<div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
									<div class="space-y-1">
										<h3 class="text-base font-medium">
                                    {participation.activity?.name || (participation as any).activity?.title || 'ไม่ระบุชื่อกิจกรรม'}
										</h3>
										{#if participation.activity?.description}
											<p class="line-clamp-2 text-sm text-muted-foreground">
												{participation.activity.description}
											</p>
										{/if}
									</div>
                            {#if participation.activity?.activity_type}
                                <Badge variant={getActivityBadgeVariant(participation.activity.activity_type)}>
                                    {getActivityTypeText(participation.activity.activity_type)}
                            </Badge>
                            {/if}
								</div>

								<!-- Details -->
								<div class="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
									<div class="flex items-center gap-2">
										<IconClock class="size-4 flex-shrink-0" />
										<span>เข้าร่วมเมื่อ: {formatDateShort(participation.participated_at)}</span>
									</div>

									{#if participation.qr_scan_location}
										<div class="flex items-center gap-2">
											<IconMapPin class="size-4 flex-shrink-0" />
											<span class="truncate">สแกนที่: {participation.qr_scan_location}</span>
										</div>
									{/if}
								</div>

								<!-- Mobile: Full date -->
								<div class="border-t pt-2 text-xs text-muted-foreground sm:hidden">
									เวลาเต็ม: {formatDate(participation.participated_at)}
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
