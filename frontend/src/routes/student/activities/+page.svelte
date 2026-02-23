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
		IconCircleCheck,
		IconBook,
		IconBallBasketball,
		IconMasksTheater,
		IconHeartHandshake,
		IconStars
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

	const counts = $derived({
		active: allActivities.filter((a) => a.status === 'published' || a.status === 'ongoing').length,
		upcoming: allActivities.filter(
			(a) => a.status === 'published' && new Date(a.start_date) >= new Date()
		).length,
		ongoing: allActivities.filter((a) => a.status === 'ongoing').length,
		completed: allActivities.filter((a) => a.status === 'completed').length
	});

	function getActivityStyle(type: string) {
		switch (type?.toLowerCase()) {
			case 'academic':
				return {
					color: 'text-blue-600 dark:text-blue-400',
					bg: 'bg-blue-500/10 dark:bg-blue-400/10',
					border: 'border-blue-500/20',
					icon: IconBook
				};
			case 'sports':
				return {
					color: 'text-orange-600 dark:text-orange-400',
					bg: 'bg-orange-500/10 dark:bg-orange-400/10',
					border: 'border-orange-500/20',
					icon: IconBallBasketball
				};
			case 'cultural':
				return {
					color: 'text-purple-600 dark:text-purple-400',
					bg: 'bg-purple-500/10 dark:bg-purple-400/10',
					border: 'border-purple-500/20',
					icon: IconMasksTheater
				};
			case 'social':
				return {
					color: 'text-emerald-600 dark:text-emerald-400',
					bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
					border: 'border-emerald-500/20',
					icon: IconHeartHandshake
				};
			default:
				return {
					color: 'text-slate-600 dark:text-slate-400',
					bg: 'bg-slate-500/10 dark:bg-slate-400/10',
					border: 'border-slate-500/20',
					icon: IconStars
				};
		}
	}
</script>

<MetaTags
	title="กิจกรรมทั้งหมด"
	description="เรียกดูกิจกรรมทั้งหมดที่เปิดให้ลงทะเบียนและกำลังจะมาถึง"
	type="website"
/>

<div class="space-y-6 pb-10 lg:space-y-8">
	<!-- Hero Section -->
	<div
		class="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 shadow-sm sm:p-10"
	>
		<div class="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
			<div class="space-y-3">
				<h1 class="text-3xl font-bold tracking-tight text-foreground lg:text-4xl xl:text-5xl">
					ค้นหากิจกรรมที่สนใจ
				</h1>
				<p class="max-w-xl text-base text-muted-foreground lg:text-lg">
					ดูและเลือกลงทะเบียนเข้าร่วมกิจกรรมต่างๆ ที่จะช่วยเสริมสร้างประสบการณ์และทักษะของคุณ
				</p>
			</div>
			<div class="w-full shrink-0 md:w-80">
				<!-- Search -->
				<div class="group relative">
					<IconSearch
						class="absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
					/>
					<Input
						bind:value={searchQuery}
						placeholder="ค้นหาชื่อ หรือ รายละเอียด..."
						class="h-14 rounded-full border-primary/20 bg-background/50 pl-12 text-base shadow-sm backdrop-blur-[2px] transition-all hover:bg-background focus-visible:ring-primary/30"
					/>
				</div>
			</div>
		</div>
		<!-- Abstract shapes for decoration -->
		<div
			class="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-primary/10 blur-[60px]"
		></div>
		<div
			class="pointer-events-none absolute -bottom-10 -left-10 size-40 rounded-full bg-primary/5 blur-3xl"
		></div>
	</div>

	<!-- Filter Tabs -->
	<Tabs bind:value={selectedFilter} class="w-full">
		<div class="scrollbar-hide mb-6 overflow-x-auto pb-2">
			<TabsList
				class="inline-flex h-12 min-w-max items-center justify-start rounded-full bg-muted/60 p-1 px-1"
			>
				<TabsTrigger
					value="active"
					class="rounded-full px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					ทั้งหมด
					{#if !loading}
						<span
							class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
						>
							{counts.active}
						</span>
					{/if}
				</TabsTrigger>
				<TabsTrigger
					value="upcoming"
					class="rounded-full px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					เปิดรับ
					{#if !loading}
						<span
							class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
						>
							{counts.upcoming}
						</span>
					{/if}
				</TabsTrigger>
				<TabsTrigger
					value="ongoing"
					class="rounded-full px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					ดำเนินการ
					{#if !loading}
						<span class="ml-2 rounded-full bg-secondary/80 px-2 py-0.5 text-[11px] font-semibold">
							{counts.ongoing}
						</span>
					{/if}
				</TabsTrigger>
				<TabsTrigger
					value="completed"
					class="rounded-full px-5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					เสร็จสิ้น
				</TabsTrigger>
			</TabsList>
		</div>

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
				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filteredActivities as activity}
						{@const statusBadge = getStatusBadge(activity)}
						{@const openReg = isRegistrationOpen(activity)}
						{@const style = getActivityStyle(activity.activity_type)}

						<Card
							class="group relative flex h-full cursor-pointer flex-col overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-primary/5 {style.border}"
							onclick={() => goto(`/student/activities/${activity.id}`)}
						>
							<!-- Decorative Top Edge -->
							<div class="absolute inset-x-0 top-0 h-1.5 {style.bg}"></div>

							<CardHeader class="relative space-y-0 pt-6 pb-3 text-left">
								<div class="mb-4 flex items-start justify-between gap-3">
									<div
										class="flex size-[42px] items-center justify-center rounded-xl {style.bg} shrink-0"
									>
										<style.icon class="size-[22px] {style.color}" />
									</div>
									<div class="flex shrink-0 flex-col items-end gap-1.5">
										<Badge
											variant={statusBadge.variant}
											class="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-sm"
										>
											{statusBadge.text}
										</Badge>
										{#if openReg}
											<span
												class="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
											>
												<span class="size-1.5 animate-pulse rounded-full bg-emerald-500"></span>
												เปิดรับสมัคร
											</span>
										{/if}
									</div>
								</div>

								<div
									class="text-[12px] font-bold tracking-widest uppercase {style.color} mb-1.5 block"
								>
									{getActivityTypeDisplayName(activity.activity_type)}
								</div>
								<CardTitle
									class="line-clamp-2 text-xl leading-snug transition-colors group-hover:text-primary"
								>
									{activity.title || 'ไม่ระบุชื่อ'}
								</CardTitle>
								{#if activity.description}
									<p
										class="mt-2.5 line-clamp-2 text-sm leading-relaxed font-normal text-muted-foreground/90"
									>
										{activity.description}
									</p>
								{/if}
							</CardHeader>

							<CardContent class="flex flex-1 flex-col justify-between pt-0 pb-5">
								<div class="mt-4 grid grid-cols-2 gap-x-2 gap-y-3.5 text-[13px]">
									<!-- Date -->
									<div
										class="flex items-center gap-2.5 text-muted-foreground {activity.end_date !==
										activity.start_date
											? 'col-span-2'
											: ''}"
									>
										<div
											class="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground/70"
										>
											<IconCalendarEvent class="size-4" />
										</div>
										<span class="truncate font-medium text-foreground/80">
											{formatDate(activity.start_date)}
											{#if activity.end_date !== activity.start_date}
												– {formatDate(activity.end_date)}
											{/if}
										</span>
									</div>

									<!-- Location -->
									{#if activity.location}
										<div
											class="col-span-2 flex items-center gap-2.5 rounded-xl border border-muted/60 bg-muted/20 p-2.5 text-muted-foreground shadow-sm"
										>
											<IconMapPin class="size-[18px] shrink-0 text-primary/70" />
											<span class="line-clamp-1 font-medium text-foreground/80"
												>{activity.location}</span
											>
										</div>
									{/if}

									<!-- Hours & Participants (Bottom row) -->
									{#if activity.hours}
										<div class="flex items-center gap-2.5 whitespace-nowrap text-muted-foreground">
											<div
												class="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground/70"
											>
												<IconHourglassHigh class="size-4" />
											</div>
											<span class="font-medium text-foreground/80">{activity.hours} ชม.</span>
										</div>
									{/if}
									{#if activity.max_participants}
										<div class="flex items-center gap-2.5 whitespace-nowrap text-muted-foreground">
											<div
												class="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground/70"
											>
												<IconUsers class="size-4" />
											</div>
											<span class="font-medium text-foreground/80"
												>{activity.max_participants} คน</span
											>
										</div>
									{/if}
								</div>

								<!-- Organizer Footer -->
								{#if activity.organizer_name}
									<div class="mt-6 flex items-center justify-between border-t border-muted/40 pt-4">
										<div class="flex items-center gap-2.5">
											<div
												class="flex size-7 items-center justify-center rounded-full border border-primary/10 bg-primary/10 text-[10px] font-bold text-primary uppercase shadow-sm"
											>
												{activity.organizer_name.substring(0, 1)}
											</div>
											<span
												class="max-w-[120px] truncate text-xs font-medium text-muted-foreground"
											>
												{activity.organizer_name}
											</span>
										</div>
										<div
											class="flex items-center text-primary/0 transition-colors group-hover:text-primary"
										>
											<IconChevronRight class="size-5" />
										</div>
									</div>
								{/if}
								{#if !activity.organizer_name}
									<div
										class="mt-6 flex items-center justify-end border-t border-muted/40 pt-4 text-primary/0 transition-colors group-hover:text-primary"
									>
										<IconChevronRight class="size-5" />
									</div>
								{/if}
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
