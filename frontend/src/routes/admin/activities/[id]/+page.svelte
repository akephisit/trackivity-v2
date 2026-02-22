<script lang="ts">
	import { activities as activitiesApi, type Activity } from '$lib/api';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		IconClock,
		IconUsers,
		IconMapPin,
		IconArrowLeft,
		IconEdit,
		IconTrash,
		IconInfoCircle,
		IconBuildingBank,
		IconUser,
		IconSettings,
		IconCategory,
		IconCalendar,
		IconClockHour3
	} from '@tabler/icons-svelte';

	let activity = $state<Activity | null>(null);
	let loading = $state(true);
	let notFound = $state(false);

	let selectedStatus = $state('');
	let updatingStatus = $state(false);
	let registrationOpen = $state(false);
	let regToggleBusy = $state(false);
	let deleteActivityDialogOpen = $state(false);

	onMount(async () => {
		const id = page.params.id!;
		try {
			activity = await activitiesApi.get(id);
			selectedStatus = activity.status;
			registrationOpen = !!activity.registration_open;
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

	const statusOptions = [
		{ value: 'draft', label: 'ร่าง' },
		{ value: 'published', label: 'เผยแพร่แล้ว' },
		{ value: 'ongoing', label: 'กำลังดำเนินการ' },
		{ value: 'completed', label: 'เสร็จสิ้น' },
		{ value: 'cancelled', label: 'ยกเลิก' }
	];

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
		if (!activity) return;
		try {
			await activitiesApi.delete(activity.id);
			deleteActivityDialogOpen = false;
			toast.success('ลบกิจกรรมสำเร็จ');
			goto('/admin/activities?deleted=1');
		} catch (e: any) {
			toast.error(e?.message || 'เกิดข้อผิดพลาดในการลบกิจกรรม');
		}
	}
</script>

<svelte:head><title>จัดการกิจกรรม - Trackivity</title></svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else if notFound || !activity}
	<div class="py-12 text-center">
		<h2 class="text-xl font-bold">ไม่พบกิจกรรม</h2>
		<Button variant="outline" class="mt-4" onclick={() => goto('/admin/activities')}>กลับ</Button>
	</div>
{:else}
	{@const statusBadge = getStatusBadge(activity.status)}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={() => goto('/admin/activities')}>
				<IconArrowLeft class="mr-2 size-4" />กลับ
			</Button>
			<div class="flex-1">
				<h1 class="admin-page-title flex items-center gap-2">
					<IconCalendar class="size-6 text-primary" />
					{activity.title}
				</h1>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => goto(`/admin/activities/${activity!.id}/edit`)}>
					<IconEdit class="mr-2 size-4" />แก้ไข
				</Button>
				<Button variant="outline" size="sm" class="text-red-600 hover:text-red-700" onclick={() => deleteActivityDialogOpen = true}>
					<IconTrash class="mr-2 size-4" />ลบ
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
						<Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
						<Badge variant={registrationOpen ? 'default' : 'outline'}>
							{registrationOpen ? 'เปิดรับลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}
						</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent class="space-y-6">
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
						<IconCategory class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ประเภทกิจกรรม</p>
							<p class="text-sm text-muted-foreground">{getActivityTypeDisplayName(activity.activity_type)}</p>
						</div>
					</div>
					{#if activity.hours}
						<div class="flex items-start gap-3">
							<IconClockHour3 class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
							<div>
								<p class="font-medium">ชั่วโมงกิจกรรม</p>
								<p class="text-sm text-muted-foreground">{activity.hours}</p>
							</div>
						</div>
					{/if}
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
						<IconBuildingBank class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงานผู้จัด</p>
							<p class="text-sm text-muted-foreground">{activity.organizer_name}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<IconUser class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ผู้สร้าง</p>
							<p class="text-sm text-muted-foreground">{activity.creator_name}</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<IconInfoCircle class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
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
						<IconSettings class="size-5" />จัดการสถานะกิจกรรม
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
				<Button class="bg-red-600 text-white hover:bg-red-700" onclick={handleDeleteActivity}>ลบกิจกรรม</Button>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
