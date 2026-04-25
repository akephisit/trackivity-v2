<script lang="ts">
	import { ArrowLeft, CircleAlert, Landmark, Calendar as CalendarIcon, LayoutGrid, Clock, Clock3, Pencil, Info, MapPin, RefreshCw, Settings, Trash2, User as UserIcon, Users } from '@lucide/svelte';
	import { activities as activitiesApi, type Activity } from '$lib/api';
	import {
		ACTIVITY_STATUS_LABEL,
		getActivityStatusBadge,
		getActivityTypeDisplayName
	} from '$lib/utils/activity';
	import type { ActivityStatus } from '$lib/types/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let activity = $state<Activity | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let loadError = $state<string | null>(null);

	let selectedStatus = $state('');
	let updatingStatus = $state(false);
	let registrationOpen = $state(false);
	let regToggleBusy = $state(false);
	let deleteActivityDialogOpen = $state(false);
	let deleting = $state(false);

	async function loadActivity() {
		const id = page.params.id!;
		loading = true;
		loadError = null;
		notFound = false;
		try {
			activity = await activitiesApi.get(id);
			selectedStatus = activity.status;
			registrationOpen = !!activity.registration_open;
		} catch (e: any) {
			if (e?.status === 404) notFound = true;
			else loadError = e?.message ?? 'ไม่สามารถโหลดข้อมูลกิจกรรมได้';
		} finally {
			loading = false;
		}
	}

	onMount(loadActivity);

	function formatDateTime(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric', month: 'long', day: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	const statusOptions = (
		Object.entries(ACTIVITY_STATUS_LABEL) as [ActivityStatus, string][]
	).map(([value, label]) => ({ value, label }));

	async function handleUpdateStatus() {
		if (!activity || selectedStatus === activity.status) return;
		updatingStatus = true;
		const prev = activity.status;
		try {
			const updated = await activitiesApi.update(activity.id, { status: selectedStatus });
			activity = updated;
			toast.success('อัปเดตสถานะสำเร็จ');
		} catch (e: any) {
			selectedStatus = prev;
			toast.error(e?.message || 'ไม่สามารถอัปเดตสถานะได้');
		} finally {
			updatingStatus = false;
		}
	}

	async function handleToggleRegistration() {
		if (!activity || regToggleBusy) return;
		regToggleBusy = true;
		const newVal = !registrationOpen;
		registrationOpen = newVal;
		try {
			const updated = await activitiesApi.update(activity.id, { registration_open: newVal });
			activity = updated;
			toast.success(newVal ? 'เปิดรับลงทะเบียนสำเร็จ' : 'ปิดรับลงทะเบียนสำเร็จ');
		} catch (e: any) {
			registrationOpen = !newVal;
			toast.error(e?.message || 'ไม่สามารถเปลี่ยนสถานะการลงทะเบียนได้');
		} finally {
			regToggleBusy = false;
		}
	}

	async function handleDeleteActivity() {
		if (!activity || deleting) return;
		deleting = true;
		try {
			await activitiesApi.delete(activity.id);
			toast.success('ลบกิจกรรมสำเร็จ');
			goto('/admin/activities?deleted=1');
		} catch (e: any) {
			deleting = false;
			deleteActivityDialogOpen = false;
			toast.error(e?.message || 'เกิดข้อผิดพลาดในการลบกิจกรรม');
		}
	}
</script>

<svelte:head><title>จัดการกิจกรรม - Trackivity</title></svelte:head>

{#if loading}
	<div class="space-y-6">
		<div class="flex items-center gap-4">
			<Skeleton class="h-9 w-20" />
			<Skeleton class="h-8 w-64 flex-1" />
			<Skeleton class="h-9 w-20" />
			<Skeleton class="h-9 w-20" />
		</div>
		<Skeleton class="h-14 w-full" />
		<Skeleton class="h-96 w-full" />
	</div>
{:else if notFound}
	<div class="py-12 text-center">
		<h2 class="text-xl font-bold">ไม่พบกิจกรรม</h2>
		<Button variant="outline" class="mt-4" onclick={() => goto('/admin/activities')}>กลับ</Button>
	</div>
{:else if loadError || !activity}
	<div class="space-y-4">
		<Alert variant="destructive">
			<CircleAlert class="size-4" />
			<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<span>{loadError ?? 'ไม่สามารถโหลดข้อมูลกิจกรรมได้'}</span>
				<Button size="sm" variant="outline" onclick={loadActivity}>
					<RefreshCw class="mr-2 size-4" />ลองใหม่
				</Button>
			</AlertDescription>
		</Alert>
	</div>
{:else}
	{@const statusBadge = getActivityStatusBadge(activity.status)}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={() => goto('/admin/activities')}>
				<ArrowLeft class="mr-2 size-4" />กลับ
			</Button>
			<div class="flex-1">
				<h1 class="admin-page-title flex items-center gap-2">
					<CalendarIcon class="size-6 text-primary" />
					{activity.title}
				</h1>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => goto(`/admin/activities/${activity!.id}/edit`)}>
					<Pencil class="mr-2 size-4" />แก้ไข
				</Button>
				<Button variant="destructive" size="sm" onclick={() => deleteActivityDialogOpen = true}>
					<Trash2 class="mr-2 size-4" />ลบ
				</Button>
			</div>
		</div>

		<!-- Registration toggle -->
		<div
			class="flex cursor-pointer items-center gap-3 rounded-md border p-3"
			role="button"
			tabindex="0"
			onclick={handleToggleRegistration}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleRegistration()}
		>
			<Switch bind:checked={registrationOpen} class="pointer-events-none" />
			<span class="text-sm">{registrationOpen ? 'เปิดให้นักศึกษาลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}</span>
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
					<div class="flex gap-2">
						<Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
						<Badge variant={registrationOpen ? 'default' : 'outline'}>
							{registrationOpen ? 'เปิดรับลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}
						</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent class="space-y-6">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="flex items-start gap-3">
						<Clock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">วันที่เริ่มต้น</p>
							<p class="text-sm text-muted-foreground">{formatDateTime(activity.start_date)}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Clock class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">วันที่สิ้นสุด</p>
							<p class="text-sm text-muted-foreground">{formatDateTime(activity.end_date)}</p>
						</div>
					</div>
					{#if activity.location}
						<div class="flex items-start gap-3">
							<MapPin class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">สถานที่</p>
								<p class="text-sm text-muted-foreground">{activity.location}</p>
							</div>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<LayoutGrid class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ประเภทกิจกรรม</p>
							<p class="text-sm text-muted-foreground">{getActivityTypeDisplayName(activity.activity_type)}</p>
						</div>
					</div>
					{#if activity.hours}
						<div class="flex items-start gap-3">
							<Clock3 class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">ชั่วโมงกิจกรรม</p>
								<p class="text-sm text-muted-foreground">{activity.hours}</p>
							</div>
						</div>
					{/if}
					{#if activity.max_participants}
						<div class="flex items-start gap-3">
							<Users class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">จำนวนที่รับได้</p>
								<p class="text-sm text-muted-foreground">{activity.max_participants} คน</p>
							</div>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<Landmark class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงานผู้จัด</p>
							<p class="text-sm text-muted-foreground">{activity.organizer_name}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<UserIcon class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ผู้สร้าง</p>
							<p class="text-sm text-muted-foreground">{activity.creator_name}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Info class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">สร้างเมื่อ</p>
							<p class="text-sm text-muted-foreground">{formatDateTime(activity.created_at)}</p>
						</div>
					</div>
				</div>

				<Separator />

				<!-- Quick Status Update -->
				<div class="space-y-4">
					<h3 class="flex items-center gap-2 text-lg font-semibold">
						<Settings class="size-5" />จัดการสถานะกิจกรรม
					</h3>
					<div class="flex items-center gap-4">
						<div class="flex-1">
							<Select.Root type="single" bind:value={selectedStatus}>
								<Select.Trigger class="w-full">
									{selectedStatus ? statusOptions.find((s) => s.value === selectedStatus)?.label || 'เลือกสถานะ' : 'เลือกสถานะ'}
								</Select.Trigger>
								<Select.Content>
									{#each statusOptions as option}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<Button onclick={handleUpdateStatus} disabled={updatingStatus || selectedStatus === activity.status}>
							{updatingStatus ? 'กำลังอัปเดต...' : 'อัปเดตสถานะ'}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Delete Activity Confirmation -->
	<AlertDialog.Root bind:open={deleteActivityDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>ยืนยันการลบกิจกรรม</AlertDialog.Title>
				<AlertDialog.Description>
					คุณแน่ใจหรือไม่ที่จะลบกิจกรรม "{activity.title}"?
					<br />การดำเนินการนี้ไม่สามารถยกเลิกได้
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => deleteActivityDialogOpen = false}>ยกเลิก</AlertDialog.Cancel>
				<AlertDialog.Action
					class="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
					onclick={(e) => { e.preventDefault(); handleDeleteActivity(); }}
					disabled={deleting}
				>
					{deleting ? 'กำลังลบ...' : 'ลบกิจกรรม'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
