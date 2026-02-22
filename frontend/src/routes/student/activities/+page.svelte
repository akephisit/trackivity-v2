<script lang="ts">
	import { activitiesApi, type Activity } from '$lib/api';
	import { onMount } from 'svelte';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		IconCalendarEvent,
		IconClock,
		IconUsers,
		IconMapPin,
		IconSearch,
		IconAlertCircle,
		IconChevronRight,
		IconHourglassHigh,
		IconCircleCheck
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';

	let allActivities = $state<Activity[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedFilter = $state('active');

	onMount(async () => {
		try {
			allActivities = await activitiesApi.list();
		} catch {
			error = 'ไม่สามารถโหลดกิจกรรมได้ กรุณาลองใหม่';
		} finally {
			loading = false;
		}
	});

	const filteredActivities = $derived.by(() => {
		let filtered = allActivities;

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(a) => a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
			);
		}

		switch (selectedFilter) {
			case 'active':
				filtered = filtered.filter((a) => a.status === 'published' || a.status === 'ongoing');
				break;
			case 'upcoming':
				filtered = filtered.filter(
					(a) => a.status === 'published' && new Date(a.start_date) >= new Date()
				);
				break;
			case 'ongoing':
				filtered = filtered.filter((a) => a.status === 'ongoing');
				break;
			case 'completed':
				filtered = filtered.filter((a) => a.status === 'completed');
				break;
		}

		return filtered.sort(
			(a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
		);
	});

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getStatusBadge(activity: Activity): {
		text: string;
		variant: 'default' | 'secondary' | 'outline' | 'destructive';
	} {
		switch (activity.status) {
			case 'published':
				return { text: 'เปิดรับสมัคร', variant: 'default' };
			case 'ongoing':
				return { text: 'กำลังดำเนินการ', variant: 'secondary' };
			case 'completed':
				return { text: 'เสร็จสิ้น', variant: 'outline' };
			case 'cancelled':
				return { text: 'ยกเลิก', variant: 'destructive' };
			default:
				return { text: activity.status, variant: 'outline' };
		}
	}

	function isRegistrationOpen(activity: Activity): boolean {
		return activity.registration_open === true && activity.status === 'published';
	}

	// Tab counts derived from all data regardless of search
	const counts = $derived({
		active: allActivities.filter((a) => a.status === 'published' || a.status === 'ongoing').length,
		upcoming: allActivities.filter(
			(a) => a.status === 'published' && new Date(a.start_date) >= new Date()
		).length,
		ongoing: allActivities.filter((a) => a.status === 'ongoing').length,
		completed: allActivities.filter((a) => a.status === 'completed').length
	});
</script>

<MetaTags
	title="กิจกรรมทั้งหมด"
	description="เรียกดูกิจกรรมทั้งหมดที่เปิดให้ลงทะเบียนและกำลังจะมาถึง"
	type="website"
/>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold lg:text-3xl">กิจกรรมทั้งหมด</h1>
		<p class="text-muted-foreground">ดูและติดตามกิจกรรมต่างๆ ที่มีอยู่ในระบบ</p>
	</div>

	<!-- Search -->
	<div class="relative">
		<IconSearch class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
		<Input bind:value={searchQuery} placeholder="ค้นหากิจกรรม..." class="pl-9" />
	</div>

	<!-- Filter Tabs -->
	<Tabs bind:value={selectedFilter} class="w-full">
		<TabsList class="grid w-full grid-cols-4">
			<TabsTrigger value="active" class="text-xs sm:text-sm">
				ทั้งหมด
				{#if !loading}
					<span
						class="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary"
					>
						{counts.active}
					</span>
				{/if}
			</TabsTrigger>
			<TabsTrigger value="upcoming" class="text-xs sm:text-sm">
				เปิดรับ
				{#if !loading}
					<span
						class="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary"
					>
						{counts.upcoming}
					</span>
				{/if}
			</TabsTrigger>
			<TabsTrigger value="ongoing" class="text-xs sm:text-sm">
				ดำเนินการ
				{#if !loading}
					<span class="ml-1 rounded-full bg-secondary/80 px-1.5 py-0.5 text-xs font-semibold">
						{counts.ongoing}
					</span>
				{/if}
			</TabsTrigger>
			<TabsTrigger value="completed" class="text-xs sm:text-sm">เสร็จสิ้น</TabsTrigger>
		</TabsList>

		<div class="mt-6">
			{#if error}
				<Alert variant="destructive">
					<IconAlertCircle class="size-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{:else if loading}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each Array(6) as _}
						<Card>
							<CardHeader>
								<div class="space-y-2">
									<Skeleton class="h-4 w-3/4" />
									<Skeleton class="h-3 w-1/2" />
								</div>
							</CardHeader>
							<CardContent>
								<div class="space-y-2">
									<Skeleton class="h-3 w-full" />
									<Skeleton class="h-3 w-2/3" />
									<Skeleton class="mt-3 h-8 w-full" />
								</div>
							</CardContent>
						</Card>
					{/each}
				</div>
			{:else if filteredActivities.length === 0}
				<div class="py-16 text-center">
					<IconCalendarEvent class="mx-auto mb-4 size-14 text-muted-foreground/40" />
					<h3 class="mb-2 text-lg font-medium">ไม่พบกิจกรรม</h3>
					<p class="text-muted-foreground">
						{searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'ยังไม่มีกิจกรรมในหมวดนี้'}
					</p>
					{#if searchQuery}
						<Button variant="outline" onclick={() => (searchQuery = '')} class="mt-4">
							ล้างการค้นหา
						</Button>
					{/if}
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredActivities as activity}
						{@const statusBadge = getStatusBadge(activity)}
						{@const openReg = isRegistrationOpen(activity)}
						<Card
							class="group flex cursor-pointer flex-col transition-all hover:shadow-md"
							onclick={() => goto(`/student/activities/${activity.id}`)}
						>
							<CardHeader class="pb-2">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<CardTitle
											class="line-clamp-2 text-base transition-colors group-hover:text-primary"
										>
											{activity.title || 'ไม่ระบุชื่อ'}
										</CardTitle>
									</div>
									<Badge variant={statusBadge.variant} class="shrink-0 text-xs">
										{statusBadge.text}
									</Badge>
								</div>
								{#if activity.description}
									<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
										{activity.description}
									</p>
								{/if}
							</CardHeader>

							<CardContent class="flex flex-1 flex-col justify-between space-y-3">
								<div class="space-y-2">
									<!-- Date -->
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<IconClock class="size-3.5 shrink-0" />
										<span>
											{formatDate(activity.start_date)}
											{#if activity.end_date !== activity.start_date}
												– {formatDate(activity.end_date)}
											{/if}
										</span>
									</div>

									<!-- Location -->
									{#if activity.location}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<IconMapPin class="size-3.5 shrink-0" />
											<span class="line-clamp-1">{activity.location}</span>
										</div>
									{/if}

									<!-- Hours & Participants -->
									<div class="flex items-center gap-4 text-sm text-muted-foreground">
										{#if activity.hours}
											<div class="flex items-center gap-1">
												<IconHourglassHigh class="size-3.5" />
												<span>{activity.hours} ชม.</span>
											</div>
										{/if}
										{#if activity.max_participants}
											<div class="flex items-center gap-1">
												<IconUsers class="size-3.5" />
												<span>ไม่เกิน {activity.max_participants} คน</span>
											</div>
										{/if}
									</div>
								</div>

								<!-- Footer -->
								<div class="flex items-center justify-between border-t pt-3">
									{#if openReg}
										<Badge variant="default" class="gap-1 text-xs">
											<IconCircleCheck class="size-3" />
											เปิดลงทะเบียน
										</Badge>
									{:else}
										<div></div>
									{/if}
									<Button
										size="sm"
										variant="ghost"
										class="gap-1 transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
									>
										ดูรายละเอียด
										<IconChevronRight class="size-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					{/each}
				</div>

				<div class="mt-4 text-center text-sm text-muted-foreground">
					แสดง {filteredActivities.length} กิจกรรม
				</div>
			{/if}
		</div>
	</Tabs>
</div>
