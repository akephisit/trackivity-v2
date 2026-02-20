<script lang="ts">
	import { activities as activitiesApi, type Activity } from '$lib/api';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		IconClock,
		IconUsers,
		IconMapPin,
		IconArrowLeft,
		IconUserCheck,
		IconInfoCircle,
		IconBuildingBank,
		IconUser
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let activity = $state<Activity | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let registering = $state(false);
	let registered = $state(false);

	onMount(async () => {
		const id = page.params.id;
		try {
			activity = await activitiesApi.get(id);
		} catch (e: any) {
			if (e?.status === 404) notFound = true;
		} finally {
			loading = false;
		}
	});

	function formatDateTime(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric', month: 'long', day: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	function getStatusBadge(status: string): { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
		switch (status) {
			case 'draft': return { text: 'ร่าง', variant: 'outline' };
			case 'published': return { text: 'เผยแพร่แล้ว', variant: 'default' };
			case 'ongoing': return { text: 'กำลังดำเนินการ', variant: 'secondary' };
			case 'completed': return { text: 'เสร็จสิ้น', variant: 'outline' };
			case 'cancelled': return { text: 'ยกเลิก', variant: 'destructive' };
			default: return { text: status, variant: 'outline' };
		}
	}

	async function registerForActivity() {
		if (!activity) return;
		registering = true;
		try {
			await activitiesApi.join(activity.id);
			toast.success('ลงทะเบียนล่วงหน้าสำเร็จ');
			registered = true;
		} catch (e: any) {
			toast.error(e?.message || 'เกิดข้อผิดพลาดในการลงทะเบียนล่วงหน้า');
		} finally {
			registering = false;
		}
	}

	function goBack() {
		goto('/student/activities');
	}
</script>

<MetaTags
	title={activity ? `${activity.title} — รายละเอียดกิจกรรม` : 'รายละเอียดกิจกรรม'}
	description={activity?.description || 'รายละเอียดกิจกรรมจากระบบติดตามกิจกรรม'}
	type="article"
/>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else if notFound || !activity}
	<div class="py-12 text-center">
		<h2 class="text-xl font-bold">ไม่พบกิจกรรม</h2>
		<Button variant="outline" class="mt-4" onclick={() => goto('/student/activities')}>กลับ</Button>
	</div>
{:else}
	{@const status = getStatusBadge(activity.status)}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={goBack}>
				<IconArrowLeft class="mr-2 size-4" />กลับ
			</Button>
			<div class="flex-1">
				<h1 class="text-2xl font-bold lg:text-3xl">{activity.title}</h1>
				<p class="text-muted-foreground">รายละเอียดกิจกรรม</p>
			</div>
		</div>

		<!-- Activity Details Card -->
		<Card>
			<CardHeader>
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1">
						<CardTitle class="text-xl">{activity.title}</CardTitle>
						{#if activity.description}
							<p class="mt-2 text-muted-foreground">{activity.description}</p>
						{/if}
					</div>
					<Badge variant={status.variant}>{status.text}</Badge>
				</div>
			</CardHeader>

			<CardContent class="space-y-6">
				<!-- Activity Info Grid -->
				<div class="grid gap-4 md:grid-cols-2">
					<div class="flex items-start gap-3">
						<IconClock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">วันที่เริ่มต้น</p>
							<p class="text-sm text-muted-foreground">{formatDateTime(activity.start_date)}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<IconClock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">วันที่สิ้นสุด</p>
							<p class="text-sm text-muted-foreground">{formatDateTime(activity.end_date)}</p>
						</div>
					</div>
					{#if activity.location}
						<div class="flex items-start gap-3">
							<IconMapPin class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">สถานที่</p>
								<p class="text-sm text-muted-foreground">{activity.location}</p>
							</div>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<IconInfoCircle class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ประเภทกิจกรรม</p>
							<Badge variant="secondary" class="text-xs">{getActivityTypeDisplayName(activity.activity_type)}</Badge>
						</div>
					</div>
					{#if activity.hours}
						<div class="flex items-start gap-3">
							<IconClock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">ชั่วโมงกิจกรรม</p>
								<p class="text-sm text-muted-foreground">{activity.hours} ชั่วโมง</p>
							</div>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<IconBuildingBank class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงานผู้จัด</p>
							<p class="text-sm text-muted-foreground">{activity.organizer_name}</p>
						</div>
					</div>
					{#if activity.max_participants}
						<div class="flex items-start gap-3">
							<IconUsers class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">จำนวนที่รับได้</p>
								<p class="text-sm text-muted-foreground">{activity.max_participants} คน</p>
							</div>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<IconUser class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ผู้สร้าง</p>
							<p class="text-sm text-muted-foreground">{activity.creator_name}</p>
						</div>
					</div>
				</div>

				<Separator />

				<!-- Registration Section -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold">สถานะการลงทะเบียนล่วงหน้า</h3>
					{#if registered}
						<Alert>
							<IconUserCheck class="size-4" />
							<AlertDescription>คุณได้ลงทะเบียนล่วงหน้าสำหรับกิจกรรมนี้แล้ว</AlertDescription>
						</Alert>
					{:else if activity.status === 'published' && activity.registration_open}
						<Button onclick={registerForActivity} disabled={registering} class="w-full sm:w-auto">
							<IconUserCheck class="mr-2 size-4" />
							{registering ? 'กำลังลงทะเบียนล่วงหน้า...' : 'ลงทะเบียนล่วงหน้า'}
						</Button>
					{:else}
						<Alert>
							<IconInfoCircle class="size-4" />
							<AlertDescription>กิจกรรมนี้ไม่เปิดให้ลงทะเบียนล่วงหน้า</AlertDescription>
						</Alert>
					{/if}
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
