<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activities as activitiesApi, type Activity, type DashboardResponse } from '$lib/api';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		IconUser,
		IconLogout,
		IconCalendar,
		IconMapPin,
		IconUsers,
		IconClock,
		IconArrowRight,
		IconTrendingUp,
		IconCalendarEvent,
		IconUserPlus,
		IconSun,
		IconMoon
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { mode, setMode } from 'mode-watcher';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';

	let dashboard = $state<DashboardResponse | null>(null);
	let loading = $state(true);

	onMount(async () => {
		await authStore.initialize();
		try {
			dashboard = await activitiesApi.dashboard();
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	});

	function toggleTheme() {
		setMode(mode.current === 'light' ? 'dark' : 'light');
	}

	async function handleLogout() {
		try {
			await authStore.logout();
			toast.success('ออกจากระบบสำเร็จ');
		} catch {
			toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
		}
	}
</script>

<MetaTags
	title="ระบบติดตามกิจกรรม"
	description="จัดการและติดตามกิจกรรมทั้งหมดของมหาวิทยาลัยในที่เดียว"
	type="website"
/>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b bg-card">
		<div class="container mx-auto px-4 py-6">
			<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 class="text-3xl font-bold text-foreground">ระบบติดตามกิจกรรม</h1>
					<p class="mt-1 text-muted-foreground">
						จัดการและติดตามกิจกรรมทั้งหมดของมหาวิทยาลัยในที่เดียว
					</p>
					{#if authStore.user}
						<p class="mt-2 text-sm text-muted-foreground">
							ยินดีต้อนรับ, {authStore.user.first_name}
							{authStore.user.last_name}
						</p>
					{/if}
				</div>
				<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
					<div class="text-sm text-muted-foreground">
						{new Date().toLocaleDateString('th-TH', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							weekday: 'long'
						})}
					</div>
					{#if authStore.user}
						<div class="flex items-center gap-2">
							<Button onclick={toggleTheme} variant="outline" size="sm" class="flex items-center gap-2">
								{#if mode.current === 'light'}
									<IconMoon class="h-4 w-4" />
									<span class="hidden sm:inline">โหมดมืด</span>
								{:else}
									<IconSun class="h-4 w-4" />
									<span class="hidden sm:inline">โหมดสว่าง</span>
								{/if}
							</Button>
							{#if authStore.user.admin_role}
								<Button href="/admin" variant="outline" size="sm" class="flex items-center gap-2">
									<IconUser class="h-4 w-4" />
									แอดมิน
								</Button>
							{:else}
								<Button href="/student" variant="outline" size="sm" class="flex items-center gap-2">
									<IconUser class="h-4 w-4" />
									นักศึกษา
								</Button>
							{/if}
							<Button onclick={handleLogout} variant="outline" size="sm" class="flex items-center gap-2">
								<IconLogout class="h-4 w-4" />
								ออกจากระบบ
							</Button>
						</div>
					{:else}
						<div class="flex items-center gap-2">
							<Button onclick={toggleTheme} variant="outline" size="sm" class="flex items-center gap-2">
								{#if mode.current === 'light'}
									<IconMoon class="h-4 w-4" />
								{:else}
									<IconSun class="h-4 w-4" />
								{/if}
							</Button>
							<Button href="/login" variant="outline" size="sm" class="flex items-center gap-2">
								<IconUser class="h-4 w-4" />
								เข้าสู่ระบบ
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto space-y-12 px-4 py-8">
		{#if loading}
			<div class="py-12 text-center">
				<div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
				<p class="mt-4 text-muted-foreground">กำลังโหลดข้อมูลกิจกรรม...</p>
			</div>
		{:else if dashboard}
			<!-- Summary Stats -->
			<section class="grid grid-cols-2 gap-6 lg:grid-cols-4">
				<Card.Root class="border-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-blue-100">กิจกรรมใหม่</p>
								<p class="text-3xl font-bold">{dashboard.recent.length}</p>
							</div>
							<div class="bg-opacity-30 rounded-lg bg-blue-400 p-3">
								<IconCalendarEvent class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="border-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-purple-100">กำลังจะมาถึง</p>
								<p class="text-3xl font-bold">{dashboard.upcoming.length}</p>
							</div>
							<div class="bg-opacity-30 rounded-lg bg-purple-400 p-3">
								<IconCalendar class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="border-0 bg-gradient-to-r from-green-500 to-green-600 text-white">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-green-100">เปิดรับสมัคร</p>
								<p class="text-3xl font-bold">{dashboard.upcoming.filter(a => a.registration_open).length}</p>
							</div>
							<div class="bg-opacity-30 rounded-lg bg-green-400 p-3">
								<IconUserPlus class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="border-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-orange-100">รวมทั้งหมด</p>
								<p class="text-3xl font-bold">{dashboard.recent.length + dashboard.upcoming.length}</p>
							</div>
							<div class="bg-opacity-30 rounded-lg bg-orange-400 p-3">
								<IconTrendingUp class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</section>

			<!-- Upcoming Activities -->
			{#if dashboard.upcoming.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">กำลังจะมาถึง</h2>
							<p class="mt-1 text-muted-foreground">กิจกรรมที่จะจัดขึ้นในอนาคตอันใกล้</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด <IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each dashboard.upcoming as activity}
							<Card.Root
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="cursor-pointer transition-shadow hover:shadow-lg"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<h3 class="line-clamp-2 text-lg leading-tight font-semibold">{activity.title}</h3>
											<Badge variant="secondary" class="ml-2 shrink-0">
												{activity.status === 'published' ? 'เผยแพร่' : 'กำลังดำเนินการ'}
											</Badge>
										</div>
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.start_date).toLocaleDateString('th-TH')}</span>
											</div>
											{#if activity.location}
												<div class="flex items-center gap-2">
													<IconMapPin class="h-4 w-4" />
													<span class="line-clamp-1">{activity.location}</span>
												</div>
											{/if}
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizer_name}</span>
											</div>
										</div>
										<div class="flex items-center gap-2">
											<Badge variant="secondary" class="text-xs">{getActivityTypeDisplayName(activity.activity_type)}</Badge>
											<Badge variant="outline" class="text-xs">{activity.hours} ชั่วโมง</Badge>
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Recent Activities -->
			{#if dashboard.recent.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">กิจกรรมล่าสุด</h2>
							<p class="mt-1 text-muted-foreground">กิจกรรมที่เพิ่งเผยแพร่ใหม่</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด <IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each dashboard.recent as activity}
							<Card.Root
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="cursor-pointer border-blue-200 bg-blue-50/50 transition-shadow hover:shadow-lg"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<h3 class="line-clamp-2 text-lg leading-tight font-semibold">{activity.title}</h3>
											<Badge variant="default" class="ml-2 shrink-0 bg-blue-500 text-white">ใหม่</Badge>
										</div>
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.start_date).toLocaleDateString('th-TH')}</span>
											</div>
											{#if activity.location}
												<div class="flex items-center gap-2">
													<IconMapPin class="h-4 w-4" />
													<span class="line-clamp-1">{activity.location}</span>
												</div>
											{/if}
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizer_name}</span>
											</div>
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}
		{:else}
			<div class="py-12 text-center">
				<p class="text-muted-foreground">ไม่สามารถโหลดข้อมูลกิจกรรมได้</p>
			</div>
		{/if}

		<!-- Quick Actions -->
		<section class="rounded-lg bg-muted/50 p-8">
			<div class="space-y-4 text-center">
				<h2 class="text-2xl font-bold">เริ่มต้นใช้งาน</h2>
				<p class="mx-auto max-w-2xl text-muted-foreground">
					เข้าสู่ระบบเพื่อลงทะเบียนเข้าร่วมกิจกรรม ติดตามความคืบหน้า และรับข่าวสารล่าสุด
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					{#if !authStore.user}
						<Button href="/login" size="lg" class="flex items-center gap-2">
							<IconUser class="h-5 w-5" />
							เข้าสู่ระบบ
						</Button>
						<Button href="/student/activities" variant="outline" size="lg">เรียกดูกิจกรรมทั้งหมด</Button>
					{:else}
						<Button href="/student/activities" size="lg">เรียกดูกิจกรรมทั้งหมด</Button>
						{#if authStore.user.admin_role}
							<Button href="/admin" variant="outline" size="lg">จัดการระบบ</Button>
						{:else}
							<Button href="/student" variant="outline" size="lg">หน้าผู้ใช้</Button>
						{/if}
					{/if}
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="mt-16 border-t bg-muted/30">
		<div class="container mx-auto px-4 py-6">
			<div class="text-center text-sm text-muted-foreground">
				<p>© 2025 ระบบติดตามกิจกรรม</p>
			</div>
		</div>
	</footer>
</div>
