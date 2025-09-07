<script lang="ts">
	import type { Activity, Participation } from '$lib/types/activity';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
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
	import { toast } from 'svelte-sonner';

	const { data } = $props<{ data: { activity: Activity; participations: Participation[] } }>();
	const { activity, participations } = data;

	let showParticipations = $state(false);
	let registering = $state(false);

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateRange(start: string, end: string): string {
		const startDate = new Date(start);
		const endDate = new Date(end);

		if (startDate.toDateString() === endDate.toDateString()) {
			return `${startDate.toLocaleDateString('th-TH', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})} ${startDate.toLocaleTimeString('th-TH', {
				hour: '2-digit',
				minute: '2-digit'
			})}-${endDate.toLocaleTimeString('th-TH', {
				hour: '2-digit',
				minute: '2-digit'
			})}`;
		}

		return `${formatDateTime(start)} - ${formatDateTime(end)}`;
	}

	function getStatusBadge(status: string): {
		text: string;
		variant: 'default' | 'secondary' | 'outline' | 'destructive';
	} {
		switch (status) {
			case 'draft':
				return { text: 'ร่าง', variant: 'outline' };
			case 'published':
				return { text: 'เผยแพร่แล้ว', variant: 'default' };
			case 'ongoing':
				return { text: 'กำลังดำเนินการ', variant: 'secondary' };
			case 'completed':
				return { text: 'เสร็จสิ้น', variant: 'outline' };
			case 'cancelled':
				return { text: 'ยกเลิก', variant: 'destructive' };
			default:
				return { text: status, variant: 'outline' };
		}
	}

	function getParticipationStatusBadge(status: string): {
		text: string;
		variant: 'default' | 'secondary' | 'outline' | 'destructive';
	} {
		switch (status) {
			case 'registered':
				return { text: 'ลงทะเบียนล่วงหน้าแล้ว', variant: 'outline' };
			case 'checked_in':
				return { text: 'เช็คอินแล้ว', variant: 'secondary' };
			case 'checked_out':
				return { text: 'เช็คเอาต์แล้ว', variant: 'default' };
			case 'completed':
				return { text: 'เสร็จสิ้น', variant: 'default' };
			default:
				return { text: status, variant: 'outline' };
		}
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

	async function registerForActivity() {
		registering = true;
		try {
			const response = await fetch(`/api/activities/${activity.id}/participate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const result = await response.json();
				if (result.success === true) {
					toast.success('ลงทะเบียนล่วงหน้าสำเร็จ');
					// Refresh the page to update registration status
					window.location.reload();
				} else {
					toast.error(result.message || 'เกิดข้อผิดพลาดในการลงทะเบียนล่วงหน้า');
				}
			} else {
				const error = await response.json();
				toast.error(error.message || 'เกิดข้อผิดพลาดในการลงทะเบียนล่วงหน้า');
			}
		} catch (error) {
			console.error('Registration error:', error);
			toast.error('เกิดข้อผิดพลาดในการลงทะเบียนล่วงหน้า');
		} finally {
			registering = false;
		}
	}

	function toggleParticipations() {
		showParticipations = !showParticipations;
	}

	// Students cannot edit activities; edits are in admin only

	function goBack() {
		goto('/student/activities');
	}
</script>

<MetaTags
	title={`${activity.title} — รายละเอียดกิจกรรม`}
	description={activity.description || 'รายละเอียดกิจกรรมจากระบบติดตามกิจกรรม'}
	type="article"
/>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" onclick={goBack}>
			<IconArrowLeft class="mr-2 size-4" />
			กลับ
		</Button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold lg:text-3xl">{activity.title}</h1>
			<p class="text-muted-foreground">รายละเอียดกิจกรรม</p>
		</div>
		<!-- Edit button removed for students -->
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
				{#snippet statusBadge()}
					{@const status = getStatusBadge(activity.status)}
					<Badge variant={status.variant}>
						{status.text}
					</Badge>
				{/snippet}
				{@render statusBadge()}
			</div>
		</CardHeader>

		<CardContent class="space-y-6">
			<!-- Activity Info Grid -->
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Date and Time -->
				<div class="flex items-start gap-3">
					<IconClock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div>
						<p class="font-medium">วันที่และเวลา</p>
						<p class="text-sm text-muted-foreground">
							{formatDateRange(activity.start_time, activity.end_time)}
						</p>
					</div>
				</div>

				<!-- Location -->
				<div class="flex items-start gap-3">
					<IconMapPin class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div>
						<p class="font-medium">สถานที่</p>
						<p class="text-sm text-muted-foreground">{activity.location}</p>
					</div>
				</div>

				<!-- Participants -->
				<div class="flex items-start gap-3">
					<IconUsers class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div>
						<p class="font-medium">ผู้เข้าร่วม</p>
						<p class="text-sm text-muted-foreground">
							{activity.current_participants}
							{#if activity.max_participants}
								/ {activity.max_participants}
							{/if}
							คน
						</p>
					</div>
				</div>

				<!-- Activity Type -->
				{#if activity.activity_type}
					<div class="flex items-start gap-3">
						<IconInfoCircle class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ประเภทกิจกรรม</p>
							<Badge variant={getActivityBadgeVariant(activity.activity_type)} class="text-xs">
								{getActivityTypeDisplayName(activity.activity_type)}
							</Badge>
						</div>
					</div>
				{/if}

				<!-- Faculty -->
				{#if activity.faculty_name}
					<div class="flex items-start gap-3">
						<IconBuildingBank class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงาน</p>
							<p class="text-sm text-muted-foreground">{activity.faculty_name}</p>
						</div>
					</div>
				{/if}

				<!-- Creator -->
				<div class="flex items-start gap-3">
					<IconUser class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div>
						<p class="font-medium">ผู้สร้าง</p>
						<p class="text-sm text-muted-foreground">{activity.created_by_name}</p>
					</div>
				</div>

				<!-- Created/Updated -->
				<div class="flex items-start gap-3">
					<IconInfoCircle class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div>
						<p class="font-medium">สร้างเมื่อ</p>
						<p class="text-sm text-muted-foreground">{formatDateTime(activity.created_at)}</p>
						{#if activity.updated_at !== activity.created_at}
							<p class="text-xs text-muted-foreground">
								อัปเดตล่าสุด: {formatDateTime(activity.updated_at)}
							</p>
						{/if}
					</div>
				</div>
			</div>

			<Separator />

			<!-- Registration Status and Actions -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold">สถานะการลงทะเบียนล่วงหน้า</h3>

				{#if activity.is_registered}
					<Alert>
						<IconUserCheck class="size-4" />
						<AlertDescription>
							คุณได้ลงทะเบียนล่วงหน้าสำหรับกิจกรรมนี้แล้ว
							{#if activity.user_participation_status}
								{#snippet participationBadge()}
									{@const status = getParticipationStatusBadge(activity.user_participation_status)}
									<Badge variant={status.variant} class="ml-2">
										{status.text}
									</Badge>
								{/snippet}
								{@render participationBadge()}
							{/if}
						</AlertDescription>
					</Alert>
				{:else if activity.status === 'published' && activity.registration_open}
					{#if activity.max_participants && activity.current_participants >= activity.max_participants}
						<Alert variant="destructive">
							<IconInfoCircle class="size-4" />
							<AlertDescription>กิจกรรมนี้มีผู้เข้าร่วมครบแล้ว</AlertDescription>
						</Alert>
					{:else}
						<Button onclick={registerForActivity} disabled={registering} class="w-full sm:w-auto">
							<IconUserCheck class="mr-2 size-4" />
							{registering ? 'กำลังลงทะเบียนล่วงหน้า...' : 'ลงทะเบียนล่วงหน้า'}
						</Button>
					{/if}
				{:else}
					<Alert>
						<IconInfoCircle class="size-4" />
						<AlertDescription>กิจกรรมนี้ไม่เปิดให้ลงทะเบียนล่วงหน้า</AlertDescription>
					</Alert>
				{/if}
			</div>

			<!-- Participations Section (if available) -->
			{#if participations.length > 0}
				<Separator />

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold">ผู้เข้าร่วม ({participations.length} คน)</h3>
						<Button variant="outline" size="sm" onclick={toggleParticipations}>
							{showParticipations ? 'ซ่อน' : 'แสดง'}รายชื่อ
						</Button>
					</div>

					{#if showParticipations}
						<div class="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ชื่อ</TableHead>
										<TableHead>รหัสนักศึกษา</TableHead>
										<TableHead>สาขา</TableHead>
										<TableHead>สถานะ</TableHead>
										<TableHead>ลงทะเบียนล่วงหน้าเมื่อ</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each participations as participation}
										<TableRow>
											<TableCell class="font-medium">
												{participation.user_name}
											</TableCell>
											<TableCell>{participation.student_id}</TableCell>
											<TableCell>{participation.department_name || '-'}</TableCell>
											<TableCell>
												{@const status = getParticipationStatusBadge(participation.status)}
												<Badge variant={status.variant}>
													{status.text}
												</Badge>
											</TableCell>
											<TableCell class="text-sm text-muted-foreground">
												{formatDateTime(participation.registered_at)}
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</div>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<style>
	:global(.line-clamp-1) {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
