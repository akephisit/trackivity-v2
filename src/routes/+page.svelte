<script lang="ts">
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
		IconUserPlus
	} from '@tabler/icons-svelte/icons';
	import type { PageData } from './$types';
	import { toast } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	async function handleLogout() {
		try {
			toast.success('ออกจากระบบสำเร็จ');
			await auth.logout('/');
			// Ensure server data refreshes so header updates
			await invalidateAll();
		} catch (error) {
			console.error('Logout error:', error);
			toast.error('เกิดข้อผิดพลาดในการออกจากระบบ');
		}
	}
</script>

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
					{#if data.user}
						<p class="mt-2 text-sm text-muted-foreground">
							ยินดีต้อนรับ, {data.user.first_name}
							{data.user.last_name}
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
					{#if data.user}
						<div class="flex items-center gap-2">
							{#if data.user.admin_role}
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
							<Button
								onclick={handleLogout}
								variant="outline"
								size="sm"
								class="flex items-center gap-2"
							>
								<IconLogout class="h-4 w-4" />
								ออกจากระบบ
							</Button>
						</div>
					{:else}
						<Button href="/login" variant="outline" size="sm" class="flex items-center gap-2">
							<IconUser class="h-4 w-4" />
							เข้าสู่ระบบ
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8 space-y-12">
		<!-- Summary Stats -->
		{#if data.activities}
			<section class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Card.Root class="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-blue-100 text-sm font-medium">กิจกรรมใหม่</p>
								<p class="text-3xl font-bold">{data.activities.recent.length}</p>
							</div>
							<div class="bg-blue-400 bg-opacity-30 rounded-lg p-3">
								<IconCalendarEvent class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-green-100 text-sm font-medium">เปิดรับสมัคร</p>
								<p class="text-3xl font-bold">{data.activities.openRegistration.length}</p>
							</div>
							<div class="bg-green-400 bg-opacity-30 rounded-lg p-3">
								<IconUserPlus class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-purple-100 text-sm font-medium">กำลังจะมาถึง</p>
								<p class="text-3xl font-bold">{data.activities.upcoming.length}</p>
							</div>
							<div class="bg-purple-400 bg-opacity-30 rounded-lg p-3">
								<IconCalendar class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0">
					<Card.Content class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-orange-100 text-sm font-medium">ยอดนิยม</p>
								<p class="text-3xl font-bold">{data.activities.popular.length}</p>
							</div>
							<div class="bg-orange-400 bg-opacity-30 rounded-lg p-3">
								<IconTrendingUp class="h-6 w-6" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</section>
		{/if}

		<!-- Activity Sections -->
		{#if data.activities}
			<!-- Open Registration Activities -->
			{#if data.activities.openRegistration.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">เปิดรับสมัครแล้ว</h2>
							<p class="text-muted-foreground mt-1">กิจกรรมที่เปิดให้ลงทะเบียนเข้าร่วม</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด
							<IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.activities.openRegistration as activity}
							<Card.Root 
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="hover:shadow-lg transition-shadow cursor-pointer border-green-200 bg-green-50/50"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<div class="space-y-1">
												<h3 class="font-semibold text-lg leading-tight line-clamp-2">{activity.title}</h3>
												<p class="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
											</div>
											<Badge variant="default" class="bg-green-500 text-white shrink-0 ml-2">เปิดรับสมัคร</Badge>
										</div>
										
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.startDate).toLocaleDateString('th-TH')}</span>
												{#if activity.endDate !== activity.startDate}
													<span>- {new Date(activity.endDate).toLocaleDateString('th-TH')}</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<IconMapPin class="h-4 w-4" />
												<span class="line-clamp-1">{activity.location}</span>
											</div>
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizerName}</span>
											</div>
											{#if activity.maxParticipants}
												<div class="flex items-center gap-2">
													<IconClock class="h-4 w-4" />
													<span>จำกัด {activity.maxParticipants.toLocaleString('th-TH')} คน</span>
												</div>
											{/if}
										</div>

										{#if activity.activityType}
											<div class="flex items-center gap-2">
												<Badge variant="secondary" class="text-xs">
													{activity.activityType}
												</Badge>
												<Badge variant="outline" class="text-xs">
													{activity.hours} ชั่วโมง
												</Badge>
											</div>
										{/if}
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Upcoming Activities -->
			{#if data.activities.upcoming.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">กำลังจะมาถึง</h2>
							<p class="text-muted-foreground mt-1">กิจกรรมที่จะจัดขึ้นในอนาคตอันใกล้</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด
							<IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.activities.upcoming as activity}
							<Card.Root 
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="hover:shadow-lg transition-shadow cursor-pointer border-purple-200 bg-purple-50/50"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<div class="space-y-1">
												<h3 class="font-semibold text-lg leading-tight line-clamp-2">{activity.title}</h3>
												<p class="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
											</div>
											<Badge variant="secondary" class="bg-purple-100 text-purple-700 shrink-0 ml-2">
												{activity.status === 'published' ? 'เผยแพร่' : 'กำลังดำเนินการ'}
											</Badge>
										</div>
										
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.startDate).toLocaleDateString('th-TH')}</span>
												{#if activity.endDate !== activity.startDate}
													<span>- {new Date(activity.endDate).toLocaleDateString('th-TH')}</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<IconMapPin class="h-4 w-4" />
												<span class="line-clamp-1">{activity.location}</span>
											</div>
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizerName}</span>
											</div>
											{#if activity.maxParticipants}
												<div class="flex items-center gap-2">
													<IconClock class="h-4 w-4" />
													<span>จำกัด {activity.maxParticipants.toLocaleString('th-TH')} คน</span>
												</div>
											{/if}
										</div>

										{#if activity.activityType}
											<div class="flex items-center gap-2">
												<Badge variant="secondary" class="text-xs">
													{activity.activityType}
												</Badge>
												<Badge variant="outline" class="text-xs">
													{activity.hours} ชั่วโมง
												</Badge>
											</div>
										{/if}
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Recent Activities -->
			{#if data.activities.recent.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">กิจกรรมล่าสุด</h2>
							<p class="text-muted-foreground mt-1">กิจกรรมที่เพิ่งเผยแพร่ใหม่</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด
							<IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.activities.recent as activity}
							<Card.Root 
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 bg-blue-50/50"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<div class="space-y-1">
												<h3 class="font-semibold text-lg leading-tight line-clamp-2">{activity.title}</h3>
												<p class="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
											</div>
											<Badge variant="default" class="bg-blue-500 text-white shrink-0 ml-2">ใหม่</Badge>
										</div>
										
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.startDate).toLocaleDateString('th-TH')}</span>
												{#if activity.endDate !== activity.startDate}
													<span>- {new Date(activity.endDate).toLocaleDateString('th-TH')}</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<IconMapPin class="h-4 w-4" />
												<span class="line-clamp-1">{activity.location}</span>
											</div>
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizerName}</span>
											</div>
											{#if activity.maxParticipants}
												<div class="flex items-center gap-2">
													<IconClock class="h-4 w-4" />
													<span>จำกัด {activity.maxParticipants.toLocaleString('th-TH')} คน</span>
												</div>
											{/if}
										</div>

										{#if activity.activityType}
											<div class="flex items-center gap-2">
												<Badge variant="secondary" class="text-xs">
													{activity.activityType}
												</Badge>
												<Badge variant="outline" class="text-xs">
													{activity.hours} ชั่วโมง
												</Badge>
											</div>
										{/if}
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Popular Activities -->
			{#if data.activities.popular.length > 0}
				<section class="space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-bold text-foreground">กิจกรรมยอดนิยม</h2>
							<p class="text-muted-foreground mt-1">กิจกรรมที่ได้รับความสนใจมากที่สุด</p>
						</div>
						<Button variant="outline" href="/student/activities">
							ดูทั้งหมด
							<IconArrowRight class="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.activities.popular as activity}
							<Card.Root 
								onclick={() => goto(`/student/activities/${activity.id}`)}
								class="hover:shadow-lg transition-shadow cursor-pointer border-orange-200 bg-orange-50/50"
							>
								<Card.Content class="p-6">
									<div class="space-y-4">
										<div class="flex items-start justify-between">
											<div class="space-y-1">
												<h3 class="font-semibold text-lg leading-tight line-clamp-2">{activity.title}</h3>
												<p class="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
											</div>
											<Badge variant="default" class="bg-orange-500 text-white shrink-0 ml-2">ยอดนิยม</Badge>
										</div>
										
										<div class="space-y-2 text-sm text-muted-foreground">
											<div class="flex items-center gap-2">
												<IconCalendar class="h-4 w-4" />
												<span>{new Date(activity.startDate).toLocaleDateString('th-TH')}</span>
												{#if activity.endDate !== activity.startDate}
													<span>- {new Date(activity.endDate).toLocaleDateString('th-TH')}</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<IconMapPin class="h-4 w-4" />
												<span class="line-clamp-1">{activity.location}</span>
											</div>
											<div class="flex items-center gap-2">
												<IconUsers class="h-4 w-4" />
												<span>{activity.organizerName}</span>
											</div>
											{#if activity.maxParticipants}
												<div class="flex items-center gap-2">
													<IconClock class="h-4 w-4" />
													<span>จำกัด {activity.maxParticipants.toLocaleString('th-TH')} คน</span>
												</div>
											{/if}
										</div>

										{#if activity.activityType}
											<div class="flex items-center gap-2">
												<Badge variant="secondary" class="text-xs">
													{activity.activityType}
												</Badge>
												<Badge variant="outline" class="text-xs">
													{activity.hours} ชั่วโมง
												</Badge>
											</div>
										{/if}
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</section>
			{/if}
		{:else}
			<!-- Loading or Empty State -->
			<div class="text-center py-12">
				<p class="text-muted-foreground">กำลังโหลดข้อมูลกิจกรรม...</p>
			</div>
		{/if}

		<!-- Quick Actions -->
		<section class="bg-muted/50 rounded-lg p-8">
			<div class="text-center space-y-4">
				<h2 class="text-2xl font-bold">เริ่มต้นใช้งาน</h2>
				<p class="text-muted-foreground max-w-2xl mx-auto">
					เข้าสู่ระบบเพื่อลงทะเบียนเข้าร่วมกิจกรรม ติดตามความคืบหน้า และรับข่าวสารล่าสุด
				</p>
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					{#if !data.user}
						<Button href="/login" size="lg" class="flex items-center gap-2">
							<IconUser class="h-5 w-5" />
							เข้าสู่ระบบ
						</Button>
						<Button href="/student/activities" variant="outline" size="lg">
							เรียกดูกิจกรรมทั้งหมด
						</Button>
					{:else}
						<Button href="/student/activities" size="lg">
							เรียกดูกิจกรรมทั้งหมด
						</Button>
						{#if data.user.admin_role}
							<Button href="/admin" variant="outline" size="lg">
								จัดการระบบ
							</Button>
						{:else}
							<Button href="/student" variant="outline" size="lg">
								หน้าผู้ใช้
							</Button>
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
				<p>© 2025 ระบบติดตามกิจกรรม - พัฒนาโดย KruAkeMaths</p>
			</div>
		</div>
	</footer>
</div>
