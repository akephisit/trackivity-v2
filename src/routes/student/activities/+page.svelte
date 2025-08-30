<script lang="ts">
	import type { Activity } from '$lib/types/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { Alert, AlertDescription } from '$lib/components/ui/alert';
    import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Input } from '$lib/components/ui/input';
    import {
        IconCalendarEvent,
        IconClock,
        IconUsers,
        IconMapPin,
        IconSearch,
        IconFilter,
        IconAlertCircle,
        IconChevronRight,
        IconUser
    } from '@tabler/icons-svelte';
    import { goto } from '$app/navigation';

	const { data } = $props<{ data: { activities: Activity[] } }>();
	let activities: Activity[] = $state(data?.activities ?? []);
	let filteredActivities: Activity[] = $state(activities);
	let loading = $state(false);
	let error: string | null = $state(null);
	let searchQuery = $state('');
	let selectedTab = $state('all');
	let showFilters = $state(false);

	function filterActivities() {
		let filtered = activities;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(activity) =>
					(activity.title || activity.activity_name || '').toLowerCase().includes(query) ||
					activity.description?.toLowerCase().includes(query)
			);
		}

		// Filter by tab
		const now = new Date();
		switch (selectedTab) {
			case 'upcoming':
				filtered = filtered.filter(
					(activity) => new Date(activity.start_time || activity.start_date || '') > now
				);
				break;
			case 'active':
				filtered = filtered.filter(
					(activity) =>
						new Date(activity.start_time || activity.start_date || '') <= now &&
						new Date(activity.end_time || activity.end_date || '') >= now
				);
				break;
			case 'past':
				filtered = filtered.filter(
					(activity) => new Date(activity.end_time || activity.end_date || '') < now
				);
				break;
			default:
				// 'all' - no additional filtering
				break;
		}

		filteredActivities = filtered;
	}

	// Reactive filtering
	$effect(() => {
		filterActivities();
	});

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateRange(activity: Activity): string {
		const start = activity.start_time || activity.start_date;
		const end = activity.end_time || activity.end_date;

		if (!start || !end) return 'ไม่ระบุ';

		const startDate = new Date(start);
		const endDate = new Date(end);

		if (startDate.toDateString() === endDate.toDateString()) {
			return `${startDate.toLocaleDateString('th-TH', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			})} ${startDate.toLocaleTimeString('th-TH', {
				hour: '2-digit',
				minute: '2-digit'
			})}-${endDate.toLocaleTimeString('th-TH', {
				hour: '2-digit',
				minute: '2-digit'
			})}`;
		}

		return `${formatDate(start)} - ${formatDate(end)}`;
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
				return 'secondary';
			case 'Other':
				return 'outline';
			default:
				return 'outline';
		}
	}

	function getActivityTypeText(type: string): string {
		const types: Record<string, string> = {
			Academic: 'วิชาการ',
			Sports: 'กีฬา',
			Cultural: 'วัฒนธรรม',
			Social: 'สังคม',
			Other: 'อื่นๆ'
		};
		return types[type] || type;
	}

	function getActivityStatus(activity: Activity): {
		text: string;
		variant: 'default' | 'outline' | 'destructive';
	} {
		// Use backend status if available
		if (activity.status) {
			switch (activity.status) {
				case 'draft':
					return { text: 'ร่าง', variant: 'outline' };
				case 'published':
					return { text: 'เผยแพร่แล้ว', variant: 'default' };
				case 'ongoing':
					return { text: 'กำลังดำเนินการ', variant: 'default' };
				case 'completed':
					return { text: 'เสร็จสิ้น', variant: 'outline' };
				case 'cancelled':
					return { text: 'ยกเลิก', variant: 'destructive' };
				default:
					return { text: activity.status, variant: 'outline' };
			}
		}

		// Fallback to time-based status
		const now = new Date();
		const start = new Date(activity.start_time || activity.start_date || '');
		const end = new Date(activity.end_time || activity.end_date || '');

		if (now < start) {
			return { text: 'เร็วๆ นี้', variant: 'outline' };
		} else if (now >= start && now <= end) {
			return { text: 'กำลังดำเนินการ', variant: 'default' };
		} else {
			return { text: 'สิ้นสุดแล้ว', variant: 'outline' };
		}
	}

	function toggleFilters() {
		showFilters = !showFilters;
	}

	function goToActivity(activityId: string) {
		goto(`/student/activities/${activityId}`);
	}

    // Edit functionality is not available for students; handled in admin only
</script>

<svelte:head>
	<title>กิจกรรม - Trackivity Student</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">กิจกรรมทั้งหมด</h1>
			<p class="text-muted-foreground">ดูและติดตามกิจกรรมต่างๆ ที่มีอยู่ในระบบ</p>
		</div>

		<Button variant="outline" size="sm" onclick={toggleFilters} class="sm:hidden">
			<IconFilter class="mr-2 size-4" />
			ตัวกรอง
		</Button>
	</div>

	<!-- Search and Filters -->
	<div class={`space-y-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
		<!-- Search -->
		<div class="relative">
			<IconSearch
				class="absolute top-1/2 left-3 size-4 -translate-y-1/2 transform text-muted-foreground"
			/>
			<Input bind:value={searchQuery} placeholder="ค้นหากิจกรรม..." class="pl-9" />
		</div>

		<!-- Tabs -->
		<Tabs bind:value={selectedTab} class="w-full">
			<TabsList class="grid w-full grid-cols-4">
				<TabsTrigger value="all" class="text-xs sm:text-sm">ทั้งหมด</TabsTrigger>
				<TabsTrigger value="upcoming" class="text-xs sm:text-sm">เร็วๆ นี้</TabsTrigger>
				<TabsTrigger value="active" class="text-xs sm:text-sm">กำลังดำเนิน</TabsTrigger>
				<TabsTrigger value="past" class="text-xs sm:text-sm">สิ้นสุดแล้ว</TabsTrigger>
			</TabsList>

			<div class="mt-6">
				<!-- Error State -->
				{#if error}
					<Alert variant="destructive">
						<IconAlertCircle class="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
					<!-- Loading State -->
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
										<Skeleton class="h-3 w-full" />
										<Skeleton class="h-8 w-20" />
									</div>
								</CardContent>
							</Card>
						{/each}
					</div>
					<!-- Empty State -->
				{:else if filteredActivities.length === 0}
					<div class="py-12 text-center">
						<IconCalendarEvent class="mx-auto mb-4 size-12 text-muted-foreground/50" />
						<h3 class="mb-2 text-lg font-medium">ไม่พบกิจกรรม</h3>
						<p class="text-muted-foreground">
							{searchQuery ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'ยังไม่มีกิจกรรมในระบบ'}
						</p>
						{#if searchQuery}
							<Button
								variant="outline"
								onclick={() => {
									searchQuery = '';
									selectedTab = 'all';
								}}
								class="mt-4"
							>
								ล้างการค้นหา
							</Button>
						{/if}
					</div>
					<!-- Activities Grid -->
				{:else}
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each filteredActivities as activity}
							<Card
								class="group cursor-pointer transition-shadow hover:shadow-md"
								onclick={() => goToActivity(activity.id)}
							>
								<CardHeader class="pb-3">
									<div class="flex items-start justify-between gap-2">
										<CardTitle
											class="line-clamp-2 text-base transition-colors group-hover:text-primary"
										>
											{activity.title || activity.activity_name || 'ไม่ระบุชื่อ'}
										</CardTitle>
										<div class="flex items-center gap-2">
											{#if activity.activity_type}
												<Badge variant={getActivityBadgeVariant(activity.activity_type)}>
													{getActivityTypeText(activity.activity_type)}
												</Badge>
											{/if}
                                    <!-- Edit is not available for students -->
										</div>
									</div>
									{#if activity.description}
										<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">
											{activity.description}
										</p>
									{/if}
								</CardHeader>

								<CardContent class="space-y-3">
									<!-- Date and Time -->
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<IconClock class="size-4 flex-shrink-0" />
										<span class="line-clamp-1">
											{formatDateRange(activity)}
										</span>
									</div>

									<!-- Location -->
									{#if activity.location}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<IconMapPin class="size-4 flex-shrink-0" />
											<span class="line-clamp-1">{activity.location}</span>
										</div>
									{/if}

									<!-- Participants -->
									{#if activity.max_participants || activity.current_participants}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<IconUsers class="size-4 flex-shrink-0" />
											<span>
												{activity.current_participants || 0}
												{#if activity.max_participants}
													/{activity.max_participants}
												{/if}
												คน
											</span>
										</div>
									{/if}

									<!-- Organization -->
									{#if activity.organization_name}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<IconMapPin class="size-4 flex-shrink-0" />
											<span class="line-clamp-1">{activity.organization_name}</span>
										</div>
									{/if}

									<!-- Status and Action -->
									<div class="flex items-center justify-between pt-2">
										{#snippet statusBadge()}
											{@const status = getActivityStatus(activity)}
											<Badge variant={status.variant}>
												{status.text}
											</Badge>
										{/snippet}
										{@render statusBadge()}

										<div class="flex items-center gap-2">
											{#if activity.is_registered}
												<Badge variant="outline" class="text-xs">ลงทะเบียนแล้ว</Badge>
											{/if}
											<Button
												size="sm"
												variant="ghost"
												class="transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
											>
												ดูรายละเอียด
												<IconChevronRight class="ml-1 size-4" />
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						{/each}
					</div>

					<!-- Results Count -->
					<div class="mt-6 text-center text-sm text-muted-foreground">
						พบ {filteredActivities.length} กิจกรรม
						{#if searchQuery}
							จากการค้นหา "{searchQuery}"
						{/if}
					</div>
				{/if}
			</div>
		</Tabs>
	</div>
</div>

<style>
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
