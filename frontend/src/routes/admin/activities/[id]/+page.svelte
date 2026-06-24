<script lang="ts">
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		ArrowLeft,
		CircleAlert,
		Landmark,
		Calendar as CalendarIcon,
		LayoutGrid,
		Clock,
		Clock3,
		Loader2,
		Pencil,
		Info,
		MapPin,
		RefreshCw,
		Search,
		Settings,
		Trash2,
		User as UserIcon,
		UserPlus,
		Users,
		X
	} from '@lucide/svelte';
	import {
		activities as activitiesApi,
		usersApi,
		ApiError,
		type Activity,
		type ManualCompleteParticipationResult,
		type ManualCompleteParticipationsResponse,
		type UserListItem
	} from '$lib/api';
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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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

	let manualDialogOpen = $state(false);
	let manualSearch = $state('');
	let manualSearchResults = $state<UserListItem[]>([]);
	let manualSearchLoading = $state(false);
	let manualSearchError = $state<string | null>(null);
	let selectedManualUsers = $state<UserListItem[]>([]);
	let pastedStudentIds = $state('');
	let manualNotes = $state('');
	let manualSubmitting = $state(false);
	let manualResult = $state<ManualCompleteParticipationsResponse | null>(null);

	const pastedStudentIdCount = $derived(parsePastedStudentIds(pastedStudentIds).length);
	const manualSelectionCount = $derived(selectedManualUsers.length + pastedStudentIdCount);

	async function loadActivity() {
		const id = page.params.id!;
		loading = true;
		loadError = null;
		notFound = false;
		try {
			activity = await activitiesApi.get(id);
			selectedStatus = activity.status;
			registrationOpen = !!activity.registration_open;
		} catch (e: unknown) {
			if (e instanceof ApiError && e.status === 404) notFound = true;
			else loadError = getApiErrorMessage(e, 'ไม่สามารถโหลดข้อมูลกิจกรรมได้');
		} finally {
			loading = false;
		}
	}

	onMount(loadActivity);

	function formatDateTime(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const statusOptions = (Object.entries(ACTIVITY_STATUS_LABEL) as [ActivityStatus, string][]).map(
		([value, label]) => ({ value, label })
	);
	const pastedStudentIdsPlaceholder = `65010001
65010002
65010003`;

	function getApiErrorMessage(error: unknown, fallback: string): string {
		return error instanceof ApiError ? error.message : fallback;
	}

	$effect(() => {
		const query = manualSearch.trim();
		if (!manualDialogOpen || query.length < 2) {
			manualSearchResults = [];
			manualSearchLoading = false;
			manualSearchError = null;
			return;
		}

		manualSearchLoading = true;
		manualSearchError = null;
		const timer = setTimeout(() => {
			searchManualStudents(query);
		}, 300);

		return () => clearTimeout(timer);
	});

	async function handleUpdateStatus() {
		if (!activity || selectedStatus === activity.status) return;
		updatingStatus = true;
		const prev = activity.status;
		try {
			const updated = await activitiesApi.update(activity.id, { status: selectedStatus });
			activity = updated;
			toast.success('อัปเดตสถานะสำเร็จ');
		} catch (e: unknown) {
			selectedStatus = prev;
			toast.error(getApiErrorMessage(e, 'ไม่สามารถอัปเดตสถานะได้'));
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
		} catch (e: unknown) {
			registrationOpen = !newVal;
			toast.error(getApiErrorMessage(e, 'ไม่สามารถเปลี่ยนสถานะการลงทะเบียนได้'));
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
			goto(resolve('/admin/activities?deleted=1'));
		} catch (e: unknown) {
			deleting = false;
			deleteActivityDialogOpen = false;
			toast.error(getApiErrorMessage(e, 'เกิดข้อผิดพลาดในการลบกิจกรรม'));
		}
	}

	function openManualDialog() {
		manualSearch = '';
		manualSearchResults = [];
		manualSearchError = null;
		selectedManualUsers = [];
		pastedStudentIds = '';
		manualNotes = '';
		manualResult = null;
		manualDialogOpen = true;
	}

	async function searchManualStudents(query: string) {
		try {
			const result = await usersApi.list({
				page: 1,
				per_page: 10,
				search: query,
				status: 'active'
			});
			if (manualSearch.trim() !== query) return;
			manualSearchResults = result.users.filter(
				(user) => !selectedManualUsers.some((selected) => selected.id === user.id)
			);
		} catch (e) {
			if (manualSearch.trim() !== query) return;
			manualSearchError = e instanceof ApiError ? e.message : 'ค้นหานักศึกษาไม่สำเร็จ';
			manualSearchResults = [];
		} finally {
			if (manualSearch.trim() === query) manualSearchLoading = false;
		}
	}

	function addManualUser(user: UserListItem) {
		if (selectedManualUsers.some((selected) => selected.id === user.id)) {
			toast.error('มีนักศึกษาคนนี้ในรายการแล้ว');
			return;
		}
		selectedManualUsers = [...selectedManualUsers, user];
		manualSearch = '';
		manualSearchResults = [];
		manualResult = null;
	}

	function removeManualUser(userId: string) {
		selectedManualUsers = selectedManualUsers.filter((user) => user.id !== userId);
	}

	function parsePastedStudentIds(value: string): string[] {
		const result: string[] = [];
		for (const part of value.split(/[\s,;]+/)) {
			const studentId = part.trim();
			if (!studentId || result.includes(studentId)) continue;
			result.push(studentId);
		}
		return result;
	}

	async function submitManualBatch() {
		if (!activity || manualSubmitting) return;
		const studentIds = parsePastedStudentIds(pastedStudentIds);
		const userIds = selectedManualUsers.map((user) => user.id);
		if (userIds.length === 0 && studentIds.length === 0) {
			toast.error('กรุณาเลือกนักศึกษาหรือวางรหัสนักศึกษาอย่างน้อย 1 คน');
			return;
		}

		manualSubmitting = true;
		manualResult = null;
		try {
			const result = await activitiesApi.manualCompleteParticipations(activity.id, {
				user_ids: userIds,
				student_ids: studentIds,
				notes: manualNotes.trim() || undefined
			});
			manualResult = result;
			const changed = result.summary.completed + result.summary.updated;
			toast.success(changed > 0 ? `บันทึกย้อนหลังสำเร็จ ${changed} คน` : 'ประมวลผลรายการเรียบร้อย');
			activity = await activitiesApi.get(activity.id);
			selectedManualUsers = [];
			pastedStudentIds = '';
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'บันทึกย้อนหลังไม่สำเร็จ');
		} finally {
			manualSubmitting = false;
		}
	}

	function getManualResultLabel(status: string): string {
		const labels: Record<string, string> = {
			completed: 'เพิ่มสำเร็จ',
			updated: 'อัปเดตสำเร็จ',
			already_completed: 'มีอยู่แล้ว',
			not_found: 'ไม่พบ',
			not_allowed: 'ไม่มีสิทธิ์',
			inactive: 'บัญชีไม่ใช้งาน',
			duplicate_input: 'ซ้ำ'
		};
		return labels[status] || status;
	}

	function getManualResultVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'completed':
			case 'updated':
				return 'default';
			case 'already_completed':
			case 'duplicate_input':
				return 'secondary';
			case 'not_found':
			case 'not_allowed':
			case 'inactive':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getManualResultTitle(result: ManualCompleteParticipationResult): string {
		if (result.user_name && result.student_id) return `${result.student_id} - ${result.user_name}`;
		return result.input;
	}
</script>

<MetaTags
	title={activity?.title ?? 'รายละเอียดกิจกรรม'}
	description="ดูรายละเอียดและจัดการผู้เข้าร่วมกิจกรรม"
/>

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
		<Button variant="outline" class="mt-4" onclick={() => goto(resolve('/admin/activities'))}
			>กลับ</Button
		>
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
			<Button variant="ghost" size="sm" onclick={() => goto(resolve('/admin/activities'))}>
				<ArrowLeft class="mr-2 size-4" />กลับ
			</Button>
			<div class="flex-1">
				<h1 class="admin-page-title flex items-center gap-2">
					<CalendarIcon class="size-6 text-primary" />
					{activity.title}
				</h1>
			</div>
			<div class="flex flex-wrap justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={openManualDialog}
					disabled={activity.status === 'draft' || activity.status === 'cancelled'}
				>
					<UserPlus class="mr-2 size-4" />เพิ่มย้อนหลังแบบกลุ่ม
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => goto(resolve(`/admin/activities/${activity!.id}/edit`))}
				>
					<Pencil class="mr-2 size-4" />แก้ไข
				</Button>
				<Button variant="destructive" size="sm" onclick={() => (deleteActivityDialogOpen = true)}>
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
			<span class="text-sm"
				>{registrationOpen ? 'เปิดให้นักศึกษาลงทะเบียนล่วงหน้า' : 'ปิดรับลงทะเบียนล่วงหน้า'}</span
			>
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
							<p class="text-sm text-muted-foreground">
								{getActivityTypeDisplayName(activity.activity_type)}
							</p>
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
									{selectedStatus
										? statusOptions.find((s) => s.value === selectedStatus)?.label || 'เลือกสถานะ'
										: 'เลือกสถานะ'}
								</Select.Trigger>
								<Select.Content>
									{#each statusOptions as option (option.value)}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<Button
							onclick={handleUpdateStatus}
							disabled={updatingStatus || selectedStatus === activity.status}
						>
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
				<AlertDialog.Cancel onclick={() => (deleteActivityDialogOpen = false)}
					>ยกเลิก</AlertDialog.Cancel
				>
				<AlertDialog.Action
					class="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
					onclick={(e) => {
						e.preventDefault();
						handleDeleteActivity();
					}}
					disabled={deleting}
				>
					{deleting ? 'กำลังลบ...' : 'ลบกิจกรรม'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<Dialog.Root bind:open={manualDialogOpen}>
		<Dialog.Content class="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-3xl">
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					<UserPlus class="size-5" />
					เพิ่มย้อนหลังแบบกลุ่ม
				</Dialog.Title>
				<Dialog.Description>
					เลือกนักศึกษาหรือวางรหัสนักศึกษา
					เพื่อบันทึกกิจกรรมนี้เป็นเข้าร่วมเสร็จสิ้นและนับชั่วโมงทันที
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-5">
				<div class="space-y-2">
					<Label for="manual-student-search">ค้นหานักศึกษา</Label>
					<div class="relative">
						<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="manual-student-search"
							bind:value={manualSearch}
							placeholder="พิมพ์รหัสนักศึกษา หรือชื่อ-นามสกุล"
							class="pl-9"
							disabled={manualSubmitting}
						/>
						{#if manualSearchLoading}
							<Loader2
								class="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
							/>
						{/if}
					</div>

					{#if manualSearchError}
						<p class="text-sm text-destructive">{manualSearchError}</p>
					{:else if manualSearch.trim().length >= 2 && !manualSearchLoading && manualSearchResults.length === 0}
						<p class="text-sm text-muted-foreground">ไม่พบนักศึกษาที่ตรงกับคำค้น</p>
					{/if}

					{#if manualSearchResults.length > 0}
						<div class="max-h-56 overflow-y-auto rounded-md border">
							{#each manualSearchResults as user (user.id)}
								<button
									type="button"
									class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
									onclick={() => addManualUser(user)}
									disabled={manualSubmitting}
								>
									<span class="min-w-0">
										<span class="block font-medium">
											{user.student_id} - {user.prefix}
											{user.first_name}
											{user.last_name}
										</span>
										<span class="block truncate text-xs text-muted-foreground">
											{user.organization_name ?? '-'} · {user.department_name ?? '-'}
										</span>
									</span>
									<UserPlus class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-2">
						<Label>รายการที่เลือก</Label>
						<Badge variant="outline">{selectedManualUsers.length} คน</Badge>
					</div>
					{#if selectedManualUsers.length === 0}
						<div class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
							ยังไม่ได้เลือกนักศึกษา
						</div>
					{:else}
						<div class="flex flex-wrap gap-2 rounded-md border p-3">
							{#each selectedManualUsers as user (user.id)}
								<Badge variant="secondary" class="gap-2 py-1 pr-1">
									<span>{user.student_id} - {user.first_name} {user.last_name}</span>
									<button
										type="button"
										class="rounded-sm p-0.5 hover:bg-background/80"
										onclick={() => removeManualUser(user.id)}
										disabled={manualSubmitting}
										aria-label="ลบนักศึกษาออกจากรายการ"
									>
										<X class="size-3" />
									</button>
								</Badge>
							{/each}
						</div>
					{/if}
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<Label for="manual-pasted-student-ids">วางรหัสนักศึกษาเพิ่มเติม</Label>
							<Badge variant="outline">{pastedStudentIdCount} รหัส</Badge>
						</div>
						<Textarea
							id="manual-pasted-student-ids"
							bind:value={pastedStudentIds}
							placeholder={pastedStudentIdsPlaceholder}
							rows={7}
							disabled={manualSubmitting}
						/>
						<p class="text-xs text-muted-foreground">
							รองรับการคั่นด้วยขึ้นบรรทัดใหม่ เว้นวรรค จุลภาค หรือเซมิโคลอน
						</p>
					</div>

					<div class="space-y-2">
						<Label for="manual-notes">หมายเหตุ</Label>
						<Textarea
							id="manual-notes"
							bind:value={manualNotes}
							placeholder="เช่น บันทึกย้อนหลังจากใบเซ็นชื่อ"
							rows={7}
							disabled={manualSubmitting}
						/>
						<p class="text-xs text-muted-foreground">
							หมายเหตุจะถูกบันทึกไว้กับประวัติการเข้าร่วมของนักศึกษา
						</p>
					</div>
				</div>

				<div class="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
					<span>รวมรายการที่จะส่ง</span>
					<span class="font-medium">{manualSelectionCount} รายการ</span>
				</div>

				{#if manualResult}
					<div class="space-y-3 rounded-md border p-3">
						<div class="flex flex-wrap items-center gap-2">
							<Badge>เพิ่มใหม่ {manualResult.summary.completed}</Badge>
							<Badge>อัปเดต {manualResult.summary.updated}</Badge>
							<Badge variant="secondary">มีอยู่แล้ว {manualResult.summary.already_completed}</Badge>
							<Badge variant="destructive">
								ไม่สำเร็จ {manualResult.summary.not_found +
									manualResult.summary.not_allowed +
									manualResult.summary.inactive +
									manualResult.summary.failed}
							</Badge>
							<Badge variant="outline">ซ้ำ {manualResult.summary.duplicate_input}</Badge>
						</div>
						<div class="max-h-60 overflow-y-auto rounded-md border">
							{#each manualResult.results as result, index (`${result.input}-${result.status}-${index}`)}
								<div
									class="flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
								>
									<div class="min-w-0">
										<p class="truncate font-medium">{getManualResultTitle(result)}</p>
										<p class="text-xs text-muted-foreground">{result.message}</p>
									</div>
									<Badge variant={getManualResultVariant(result.status)}>
										{getManualResultLabel(result.status)}
									</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<Dialog.Footer class="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					variant="outline"
					onclick={() => (manualDialogOpen = false)}
					disabled={manualSubmitting}
				>
					ปิด
				</Button>
				<Button
					type="button"
					onclick={submitManualBatch}
					disabled={manualSubmitting || manualSelectionCount === 0}
				>
					{#if manualSubmitting}
						<Loader2 class="mr-2 size-4 animate-spin" />
						กำลังบันทึก...
					{:else}
						บันทึกย้อนหลังทั้งหมด
					{/if}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
