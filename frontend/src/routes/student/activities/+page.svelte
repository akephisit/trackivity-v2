<script lang="ts">
	import { activities as activitiesApi, type Activity } from '$lib/api';
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
		IconChevronRight
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';

	let allActivities = $state<Activity[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedTab = $state('all');
	let selectedFilter = $state('upcoming');

	onMount(async () => {
		try {
			allActivities = await activitiesApi.list();
		} catch (e: any) {
			error = 'ไม่สามารถโหลดกิจกรรมได้ กรุณาลองใหม่';
		} finally {
			loading = false;
		}
	});

	let filteredActivities = $derived(() => {
		let filtered = allActivities;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(a) => a.title?.toLowerCase().includes(query) || a.description?.toLowerCase().includes(query)
			);
		}

		switch (selectedFilter) {
			case 'upcoming':
				filtered = filtered.filter((a) => a.status === 'published');
				break;
			case 'ongoing':
				filtered = filtered.filter((a) => a.status === 'ongoing');
				break;
			case 'completed':
				filtered = filtered.filter((a) => a.status === 'completed');
				break;
		}

		return filtered;
	});

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	function getActivityStatus(activity: Activity): { text: string; variant: 'default' | 'outline' | 'destructive' } {
		switch (activity.status) {
			case 'draft': return { text: 'ร่าง', variant: 'outline' };
			case 'published': return { text: 'เผยแพร่แล้ว', variant: 'default' };
			case 'ongoing': return { text: 'กำลังดำเนินการ', variant: 'default' };
			case 'completed': return { text: 'เสร็จสิ้น', variant: 'outline' };
			case 'cancelled': return { text: 'ยกเลิก', variant: 'destructive' };
			default: return { text: activity.status, variant: 'outline' };
		}
	}

	function resetFilters() {
		searchQuery = '';
		selectedTab = 'all';
		selectedFilter = 'upcoming';
	}
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

	<div class="space-y-4">
		<div class="relative">
			<IconSearch class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={searchQuery} placeholder="ค้นหากิจกรรม..." class="pl-9" />
		</div>

		<Tabs bind:value={selectedFilter} class="w-full">
			<TabsList class="grid w-full grid-cols-3">
				<TabsTrigger value="upcoming" class="text-xs sm:text-sm">เร็ว ๆ นี้</TabsTrigger>
				<TabsTrigger value="ongoing" class="text-xs sm:text-sm">กำลังดำเนินการ</TabsTrigger>
				<TabsTrigger value="completed" class="text-xs sm:text-sm">สิ้นสุดแล้ว</TabsTrigger>
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
										<Skeleton class="h-3 w-full" />
									</div>
								</CardContent>
							</Card>
						{/each}
					</div>
				{:else if filteredActivities().length === 0}
					<div class="py-12 text-center">
						<IconCalendarEvent class="mx-auto mb-4 size-12 text-muted-foreground/50" />
						<h3 class="mb-2 text-lg font-medium">ไม่พบกิจกรรม</h3>
						<p class="text-muted-foreground">
							{searchQuery ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'ยังไม่มีกิจกรรมในระบบ'}
						</p>
						{#if searchQuery}
							<Button variant="outline" onclick={resetFilters} class="mt-4">ล้างการค้นหา</Button>
						{/if}
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each filteredActivities() as activity}
							{@const status = getActivityStatus(activity)}
							<Card
								class="group cursor-pointer transition-shadow hover:shadow-md"
								onclick={() => goto(`/student/activities/${activity.id}`)}
							>
								<CardHeader class="pb-3">
									<div class="flex items-start justify-between gap-2">
										<CardTitle class="line-clamp-2 text-base transition-colors group-hover:text-primary">
											{activity.title || 'ไม่ระบุชื่อ'}
										</CardTitle>
										{#if activity.activity_type}
											<Badge variant="secondary">{getActivityTypeDisplayName(activity.activity_type)}</Badge>
										{/if}
									</div>
									{#if activity.description}
										<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>
									{/if}
								</CardHeader>
								<CardContent class="space-y-3">
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<IconClock class="size-4 flex-shrink-0" />
										<span>{formatDate(activity.start_date)}</span>
									</div>
									{#if activity.location}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<IconMapPin class="size-4 flex-shrink-0" />
											<span class="line-clamp-1">{activity.location}</span>
										</div>
									{/if}
									<div class="flex items-center justify-between pt-2">
										<Badge variant={status.variant}>{status.text}</Badge>
										<Button size="sm" variant="ghost" class="transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
											ดูรายละเอียด
											<IconChevronRight class="ml-1 size-4" />
										</Button>
									</div>
								</CardContent>
							</Card>
						{/each}
					</div>
					<div class="mt-6 text-center text-sm text-muted-foreground">
						พบ {filteredActivities().length} กิจกรรม
					</div>
				{/if}
			</div>
		</Tabs>
	</div>
</div>
