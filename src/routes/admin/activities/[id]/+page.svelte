<script lang="ts">
	import type {
		Activity,
		Participation,
		ParticipationStatus,
		ActivityStatus
	} from '$lib/types/activity';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
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
		IconEdit,
		IconTrash,
		IconUserCheck,
		IconInfoCircle,
		IconBuildingBank,
		IconUser,
		IconSettings,
		IconDownload,
		IconEye,
		IconEyeOff,
		IconCheck,
		IconChartBar,
		IconCategory,
		IconCalendar,
		IconClockHour3,
		IconUserHeart
	} from '@tabler/icons-svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Dialog from '$lib/components/ui/dialog';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Switch } from '$lib/components/ui/switch';

	const { data, form } = $props<{
		data: {
			activity: Activity;
			participations: Participation[];
			participationStats: any;
			faculties: any[];
			user: any;
		};
		form?: any;
	}>();

	const activity = $derived(data.activity);
	const participations = $derived(data.participations);
	const participationStats = $derived(data.participationStats);

	// Eligible faculties names mapped from server-provided IDs and faculties list
	const eligibleFacultyNames = $derived(() => {
		const ids: string[] = (data as any).eligible_organizations_selected || [];
		const list: any[] = (data as any).faculties || [];
		return ids
			.map((id: string) => list.find((f) => f.id === id)?.name)
			.filter((name: string | undefined): name is string => Boolean(name));
	});

	let showParticipations = $state(true);
	let showStats = $state(true);
	let updatingStatus = $state(false);
	let registrationOpen = $state(false);
	$effect(() => {
		registrationOpen = !!activity.registration_open;
	});
	let regToggleBusy = $state(false);

	async function onToggleRegistration(newVal: boolean) {
		if (regToggleBusy) return;
		regToggleBusy = true;
		try {
			const fd = new FormData();
			fd.append('registration_open', newVal ? '1' : '0');
			const res = await fetch('?/toggleRegistration', { method: 'POST', body: fd });
			const result = await res.json().catch(() => ({}));
			if (res.ok && (result.success === true || result.type === 'success')) {
				toast.success(
					newVal ? 'เปิดให้นักศึกษาลงทะเบียนล่วงหน้าแล้ว' : 'ปิดรับลงทะเบียนล่วงหน้าแล้ว'
				);
			} else {
				toast.error(result.error || 'อัปเดตไม่สำเร็จ');
				registrationOpen = !newVal;
			}
		} catch (e) {
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
			registrationOpen = !newVal;
		} finally {
			regToggleBusy = false;
		}
	}

	function handleRegistrationToggleClick() {
		if (regToggleBusy) return;
		const next = !registrationOpen;
		// Optimistic UI update; revert on failure inside onToggleRegistration
		registrationOpen = next;
		onToggleRegistration(next);
	}
	let selectedStatus = $state('');
	$effect(() => {
		selectedStatus = activity.status;
	});

	// Participant management states
	let editingParticipant: Participation | null = $state(null);
	let participantStatus = $state('');
	let participantNotes = $state('');
	let updatingParticipant = $state(false);

	// Delete confirmation states
	let deleteDialogOpen = $state(false);
	let deleteParticipantId = $state('');
	let deleteActivityDialogOpen = $state(false);

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

	function goBack() {
		goto('/admin/activities');
	}

	function goToEdit() {
		goto(`/admin/activities/${activity.id}/edit`);
	}

	function toggleParticipations() {
		showParticipations = !showParticipations;
	}

	function toggleStats() {
		showStats = !showStats;
	}

	// Participant management functions
	function startEditingParticipant(participant: Participation) {
		editingParticipant = participant;
		participantStatus = participant.status;
		participantNotes = participant.notes || '';
	}

	function cancelEditingParticipant() {
		editingParticipant = null;
		participantStatus = '';
		participantNotes = '';
	}

	function confirmDeleteParticipant(participationId: string) {
		deleteParticipantId = participationId;
		deleteDialogOpen = true;
	}

	function confirmDeleteActivity() {
		deleteActivityDialogOpen = true;
	}

	// Export participants data
	function exportParticipants() {
		const csv = [
			[
				'ชื่อ',
				'รหัสนักศึกษา',
				'อีเมล',
				'สาขา',
				'สถานะ',
				'ลงทะเบียนล่วงหน้าเมื่อ',
				'เช็คอินเมื่อ',
				'เช็คเอาต์เมื่อ',
				'หมายเหตุ'
			],
			...participations.map((p: Participation) => [
				p.user_name,
				p.student_id,
				p.email,
				p.department_name || '-',
				getParticipationStatusBadge(p.status).text,
				formatDateTime(p.registered_at),
				p.checked_in_at ? formatDateTime(p.checked_in_at) : '-',
				p.checked_out_at ? formatDateTime(p.checked_out_at) : '-',
				p.notes || '-'
			])
		]
			.map((row) => row.map((cell: string) => `"${cell}"`).join(','))
			.join('\n');

		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `รายชื่อผู้เข้าร่วม-${activity.title}-${new Date().toISOString().split('T')[0]}.csv`;
		link.click();
	}

	const statusOptions: { value: ActivityStatus; label: string }[] = [
		{ value: 'draft', label: 'ร่าง' },
		{ value: 'published', label: 'เผยแพร่แล้ว' },
		{ value: 'ongoing', label: 'กำลังดำเนินการ' },
		{ value: 'completed', label: 'เสร็จสิ้น' },
		{ value: 'cancelled', label: 'ยกเลิก' }
	];

	const participationStatusOptions: { value: ParticipationStatus; label: string }[] = [
		{ value: 'registered', label: 'ลงทะเบียนล่วงหน้าแล้ว' },
		{ value: 'checked_in', label: 'เช็คอินแล้ว' },
		{ value: 'checked_out', label: 'เช็คเอาต์แล้ว' },
		{ value: 'completed', label: 'เสร็จสิ้น' }
	];

	// Handle form responses
	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'ดำเนินการสำเร็จ');
			invalidateAll();
		} else if (form?.error) {
			toast.error(form.error);
		}
	});
</script>

<svelte:head>
	<title>จัดการกิจกรรม - Trackivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" onclick={goBack}>
			<IconArrowLeft class="mr-2 size-4" />
			กลับ
		</Button>
		<div class="flex-1">
			<h1 class="admin-page-title">
				<IconCalendar class="size-6 text-primary" />
				{activity.title}
			</h1>
			<p class="text-muted-foreground">จัดการกิจกรรม - Trackivity</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={goToEdit}>
				<IconEdit class="mr-2 size-4" />
				แก้ไข
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="text-red-600 hover:text-red-700"
				onclick={confirmDeleteActivity}
			>
				<IconTrash class="mr-2 size-4" />
				ลบ
			</Button>
		</div>
	</div>

	<!-- Registration toggle quick control -->
	<div
		class="flex cursor-pointer items-center gap-3 rounded-md border p-3"
		role="button"
		tabindex="0"
		onclick={handleRegistrationToggleClick}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleRegistrationToggleClick()}
	>
		<Switch bind:checked={registrationOpen} class="pointer-events-none" />
		<span class="text-sm"
			>{registrationOpen ? 'เปิดให้นักศึกษาลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}</span
		>
	</div>

	<!-- Quick Stats Cards -->
	{#if showStats}
		<div class="grid gap-4 md:grid-cols-4">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">ผู้เข้าร่วมทั้งหมด</CardTitle>
					<IconUsers class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{participationStats.total}</div>
					{#if activity.max_participants}
						<p class="text-xs text-muted-foreground">
							จาก {activity.max_participants} คน
						</p>
					{/if}
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">ลงทะเบียนล่วงหน้าแล้ว</CardTitle>
					<IconUserCheck class="h-4 w-4 text-blue-500" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-blue-600">{participationStats.registered}</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">เช็คอินแล้ว</CardTitle>
					<IconCheck class="h-4 w-4 text-green-500" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-green-600">{participationStats.checked_in}</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">เสร็จสิ้น</CardTitle>
					<IconChartBar class="h-4 w-4 text-purple-500" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-purple-600">{participationStats.completed}</div>
				</CardContent>
			</Card>
		</div>
	{/if}

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

				<!-- Registration open badge -->
				<Badge variant={registrationOpen ? 'default' : 'outline'}>
					{registrationOpen ? 'เปิดรับลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}
				</Badge>
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
							{activity.participant_count}
							{#if activity.max_participants}
								/ {activity.max_participants}
							{/if}
							คน
						</p>
					</div>
				</div>

				<!-- Organization (หน่วยงานผู้จัด) -->
				{#if activity.organizer}
					<div class="flex items-start gap-3">
						<IconBuildingBank class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงานผู้จัด</p>
							<p class="text-sm text-muted-foreground">{activity.organizer}</p>
						</div>
					</div>
				{/if}

				<!-- Eligible Organizations -->
				{#if eligibleFacultyNames().length > 0}
					<div class="flex items-start gap-3">
						<IconBuildingBank class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">หน่วยงานที่สามารถเข้าร่วมได้</p>
							<div class="flex flex-wrap gap-1">
								{#each eligibleFacultyNames() as name}
									<Badge variant="secondary">{name}</Badge>
								{/each}
							</div>
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

			<!-- Extra admin fields -->
			<div class="grid gap-4 md:grid-cols-2">
				{#if activity.activity_type}
					<div class="flex items-start gap-3">
						<IconCategory class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ประเภทกิจกรรม</p>
							<p class="text-sm text-muted-foreground">
								{getActivityTypeDisplayName(activity.activity_type)}
							</p>
						</div>
					</div>
				{/if}
				{#if activity.academic_year}
					<div class="flex items-start gap-3">
						<IconCalendar class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ปีการศึกษา</p>
							<p class="text-sm text-muted-foreground">{activity.academic_year}</p>
						</div>
					</div>
				{/if}
				{#if activity.hours}
					<div class="flex items-start gap-3">
						<IconClockHour3 class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
						<div>
							<p class="font-medium">ชั่วโมงกิจกรรม</p>
							<p class="text-sm text-muted-foreground">{activity.hours}</p>
						</div>
					</div>
				{/if}
				<!-- Removed duplicate organizer block to avoid repetition -->
			</div>

			<Separator />

			<!-- Quick Status Update -->
			<div class="space-y-4">
				<h3 class="flex items-center gap-2 text-lg font-semibold">
					<IconSettings class="size-5" />
					จัดการสถานะกิจกรรม
				</h3>

				<form
					method="POST"
					action="?/updateStatus"
					use:enhance={() => {
						updatingStatus = true;
						return async ({ update }) => {
							updatingStatus = false;
							await update();
						};
					}}
					class="flex items-center gap-4"
				>
					<input type="hidden" name="status" value={selectedStatus} />
					<div class="flex-1">
						<Select.Root type="single" bind:value={selectedStatus}>
							<Select.Trigger class="w-full">
								{selectedStatus
									? statusOptions.find((s) => s.value === selectedStatus)?.label || 'เลือกสถานะ'
									: 'เลือกสถานะ'}
							</Select.Trigger>
							<Select.Content>
								{#each statusOptions as option}
									<Select.Item value={option.value}>{option.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Button type="submit" disabled={updatingStatus || selectedStatus === activity.status}>
						{updatingStatus ? 'กำลังอัปเดต...' : 'อัปเดตสถานะ'}
					</Button>
				</form>
			</div>
		</CardContent>
	</Card>

	<!-- Participants Management -->
	{#if participations.length > 0}
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<CardTitle class="flex items-center gap-2">
						<IconUsers class="size-5" />
						ผู้เข้าร่วม ({participations.length} คน)
					</CardTitle>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={exportParticipants}>
							<IconDownload class="mr-2 size-4" />
							ส่งออก CSV
						</Button>
						<Button variant="outline" size="sm" onclick={toggleStats}>
							{#if showStats}
								<IconEyeOff class="mr-2 size-4" />
							{:else}
								<IconEye class="mr-2 size-4" />
							{/if}
							{showStats ? 'ซ่อน' : 'แสดง'}สถิติ
						</Button>
						<Button variant="outline" size="sm" onclick={toggleParticipations}>
							{#if showParticipations}
								<IconEyeOff class="mr-2 size-4" />
							{:else}
								<IconEye class="mr-2 size-4" />
							{/if}
							{showParticipations ? 'ซ่อน' : 'แสดง'}รายชื่อ
						</Button>
					</div>
				</div>
			</CardHeader>

			{#if showParticipations}
				<CardContent class="p-0">
					<div class="overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/50">
									<TableHead>ชื่อ</TableHead>
									<TableHead>รหัสนักศึกษา</TableHead>
									<TableHead>สาขา</TableHead>
									<TableHead>สถานะ</TableHead>
									<TableHead>ลงทะเบียนล่วงหน้าเมื่อ</TableHead>
									<TableHead>เช็คอิน</TableHead>
									<TableHead>เช็คเอาต์</TableHead>
									<TableHead class="text-right">การดำเนินการ</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each participations as participation}
									<TableRow>
										<TableCell class="font-medium">
											<div>
												<div class="font-semibold">{participation.user_name}</div>
												<div class="text-sm text-muted-foreground">{participation.email}</div>
											</div>
										</TableCell>
										<TableCell>{participation.student_id}</TableCell>
										<TableCell>{participation.department_name || '-'}</TableCell>
										<TableCell>
											{@const status = getParticipationStatusBadge(participation.status)}
											<Badge variant={status.variant}>
												{status.text}
											</Badge>
										</TableCell>
										<TableCell class="text-sm">
											{formatDateTime(participation.registered_at)}
										</TableCell>
										<TableCell class="text-sm">
											{participation.checked_in_at
												? formatDateTime(participation.checked_in_at)
												: '-'}
										</TableCell>
										<TableCell class="text-sm">
											{participation.checked_out_at
												? formatDateTime(participation.checked_out_at)
												: '-'}
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													onclick={() => startEditingParticipant(participation)}
													class="text-blue-600 hover:text-blue-700"
													title="แก้ไขสถานะ"
												>
													<IconEdit class="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => confirmDeleteParticipant(participation.id)}
													class="text-red-600 hover:text-red-700"
													title="ลบผู้เข้าร่วม"
												>
													<IconTrash class="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			{/if}
		</Card>
	{:else}
		<Card>
			<CardContent class="py-8 text-center">
				<IconUsers class="mx-auto mb-4 size-12 text-muted-foreground" />
				<h3 class="mb-2 text-lg font-semibold">ยังไม่มีผู้เข้าร่วม</h3>
				<p class="text-muted-foreground">ยังไม่มีผู้ใดลงทะเบียนเข้าร่วมกิจกรรมนี้</p>
			</CardContent>
		</Card>
	{/if}
</div>

<!-- Edit Participant Dialog -->
<Dialog.Root
	open={!!editingParticipant}
	onOpenChange={(open) => {
		if (!open) editingParticipant = null;
	}}
>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>แก้ไขสถานะผู้เข้าร่วม</Dialog.Title>
			<Dialog.Description>
				{#if editingParticipant}
					แก้ไขสถานะของ {editingParticipant.user_name}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if editingParticipant}
			<form
				method="POST"
				action="?/updateParticipant"
				use:enhance={() => {
					updatingParticipant = true;
					return async ({ update }) => {
						updatingParticipant = false;
						editingParticipant = null;
						await update();
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="participationId" value={editingParticipant.id} />

				<div class="space-y-2">
					<Label for="participantStatus">สถานะ</Label>
					<Select.Root type="single" bind:value={participantStatus}>
						<Select.Trigger>
							{participantStatus
								? participationStatusOptions.find((s) => s.value === participantStatus)?.label ||
									'เลือกสถานะ'
								: 'เลือกสถานะ'}
						</Select.Trigger>
						<Select.Content>
							{#each participationStatusOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="notes">หมายเหตุ</Label>
					<Textarea
						id="notes"
						name="notes"
						placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
						bind:value={participantNotes}
						rows={3}
					/>
				</div>

				<Dialog.Footer>
					<Button
						type="button"
						variant="outline"
						onclick={cancelEditingParticipant}
						disabled={updatingParticipant}
					>
						ยกเลิก
					</Button>
					<Button type="submit" disabled={updatingParticipant}>
						{updatingParticipant ? 'กำลังบันทึก...' : 'บันทึก'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Participant Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ยืนยันการลบผู้เข้าร่วม</AlertDialog.Title>
			<AlertDialog.Description>
				คุณแน่ใจหรือไม่ที่จะลบผู้เข้าร่วมคนนี้ออกจากกิจกรรม?
				<br />การดำเนินการนี้ไม่สามารถยกเลิกได้
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteDialogOpen = false)}>ยกเลิก</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-red-600 text-white hover:bg-red-700"
				onclick={async () => {
					const formData = new FormData();
					formData.append('participationId', deleteParticipantId);
					await fetch('?/removeParticipant', {
						method: 'POST',
						body: formData
					});
					deleteDialogOpen = false;
					invalidateAll();
				}}
			>
				ลบผู้เข้าร่วม
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Activity Confirmation -->
<AlertDialog.Root bind:open={deleteActivityDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ยืนยันการลบกิจกรรม</AlertDialog.Title>
			<AlertDialog.Description>
				คุณแน่ใจหรือไม่ที่จะลบกิจกรรม "{activity.title}"?
				<br />การดำเนินการนี้จะลบข้อมูลทั้งหมดรวมถึงผู้เข้าร่วม และไม่สามารถยกเลิกได้
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteActivityDialogOpen = false)}>
				ยกเลิก
			</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/deleteActivity"
				use:enhance={() =>
					async ({ update }) => {
						// Always apply the action result (follows redirects, shows errors, etc.)
						await update();
					}}
			>
				<Button type="submit" class="bg-red-600 text-white hover:bg-red-700">ลบกิจกรรม</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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
