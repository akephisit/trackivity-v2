<script lang="ts">
	import type { Activity } from '$lib/types/activity';
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
		IconChevronRight
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';

	const { data } = $props<{ data: { activities: Activity[] } }>();
	let activities: Activity[] = $state(data?.activities ?? []);
	let filteredActivities: Activity[] = $state(activities);
	let loading = $state(false);
	let error: string | null = $state(null);
	let searchQuery = $state('');
	let selectedTab = $state('all');
	let selectedFilter = $state('upcoming');

	function filterActivities() {
		let filtered = activities;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(activity) =>
					(activity.title || activity.title || '').toLowerCase().includes(query) ||
					activity.description?.toLowerCase().includes(query)
			);
		}

		// Filter by main tab (all or eligible)
		if (selectedTab === 'eligible') {
			filtered = filtered.filter((activity) => activity.is_eligible);
		}

		// Filter by sub-filter (status-based)
		switch (selectedFilter) {
			case 'upcoming':
				filtered = filtered.filter((activity) => activity.status === 'published');
				break;
			case 'ongoing':
				filtered = filtered.filter((activity) => activity.status === 'ongoing');
				break;
			case 'completed':
				filtered = filtered.filter((activity) => activity.status === 'completed');
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

	function resetFilters() {
		searchQuery = '';
		selectedTab = 'all';
		selectedFilter = 'upcoming';
	}

	function goToActivity(activityId: string) {
		goto(`/student/activities/${activityId}`);
	}

	// Edit functionality is not available for students; handled in admin only
</script>

<MetaTags
	title="กิจกรรมทั้งหมด"
	description="เรียกดูกิจกรรมทั้งหมดที่เปิดให้ลงทะเบียนและกำลังจะมาถึง"
	type="website"
/>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold lg:text-3xl">กิจกรรมทั้งหมด</h1>
		<p class="text-muted-foreground">ดูและติดตามกิจกรรมต่างๆ ที่มีอยู่ในระบบ</p>
	</div>

	<!-- Search and Filters -->
	<div class="space-y-4">
		<!-- Search -->
		<div class="relative">
			<IconSearch
				class="absolute top-1/2 left-3 size-4 -translate-y-1/2 transform text-muted-foreground"
			/>
			<Input bind:value={searchQuery} placeholder="ค้นหากิจกรรม..." class="pl-9" />
		</div>

		<!-- Main Tabs -->
		<Tabs bind:value={selectedTab} class="w-full">
			<TabsList class="grid w-full grid-cols-2">
				<TabsTrigger value="all" class="text-sm">ทั้งหมด</TabsTrigger>
				<TabsTrigger value="eligible" class="text-sm">ที่สามารถเข้าร่วมได้</TabsTrigger>
			</TabsList>

			<!-- Sub-filters for each tab -->
			<div class="mt-4">
				<Tabs bind:value={selectedFilter} class="w-full">
					<TabsList class="grid w-full grid-cols-3">
						<TabsTrigger value="upcoming" class="text-xs sm:text-sm">เร็ว ๆ นี้</TabsTrigger>
						<TabsTrigger value="ongoing" class="text-xs sm:text-sm">กำลังดำเนินการ</TabsTrigger>
						<TabsTrigger value="completed" class="text-xs sm:text-sm">สิ้นสุดแล้ว</TabsTrigger>
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
									<Button variant="outline" onclick={resetFilters} class="mt-4">
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
													{activity.title || activity.title || 'ไม่ระบุชื่อ'}
												</CardTitle>
												<div class="flex items-center gap-2">
													{#if activity.activity_type}
														<Badge variant={getActivityBadgeVariant(activity.activity_type)}>
															{getActivityTypeDisplayName(activity.activity_type)}
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
											{#if activity.max_participants || activity.participant_count}
												<div class="flex items-center gap-2 text-sm text-muted-foreground">
													<IconUsers class="size-4 flex-shrink-0" />
													<span>
														{activity.participant_count || 0}
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
													{:else if !activity.is_eligible}
														<Badge variant="destructive" class="text-xs">ไม่สามารถเข้าร่วม</Badge>
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
