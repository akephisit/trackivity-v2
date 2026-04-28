<script lang="ts">
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		ArrowLeft,
		Award,
		Building as BuildingIcon,
		Calendar as CalendarIcon,
		CalendarDays,
		CircleAlert,
		CircleCheck,
		Clock,
		Eye,
		EyeOff,
		Hourglass,
		IdCard,
		Key,
		Loader,
		Lock,
		LogIn,
		LogOut,
		Mail,
		MapPin,
		Pencil,
		RefreshCw,
		School,
		Shield,
		Trash2,
		TrendingUp,
		User as UserIcon,
		UserCheck,
		UserX,
		X
	} from '@lucide/svelte';
	import {
		usersApi,
		ApiError,
		type UserListItem,
		type UserParticipationsResponse,
		type UserParticipation
	} from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Table from '$lib/components/ui/table';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getActivityTypeDisplayName, getActivityLevelDisplayName } from '$lib/utils/activity';

	// ─── State ──────────────────────────────────────────────────────────────
	let user = $state<UserListItem | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let loadError = $state<string | null>(null);

	let history = $state<UserParticipationsResponse | null>(null);
	let historyLoading = $state(true);
	let historyError = $state<string | null>(null);

	// Edit email dialog
	let editOpen = $state(false);
	let editEmail = $state('');
	let editSubmitting = $state(false);

	// Reset password dialog
	let resetOpen = $state(false);
	let resetPassword = $state('');
	let resetShow = $state(false);
	let resetSubmitting = $state(false);

	// Delete confirmation
	let deleteOpen = $state(false);
	let deleting = $state(false);

	// Status quick-toggle in flight
	let statusBusy = $state(false);

	// ─── Loaders ────────────────────────────────────────────────────────────
	async function loadUser() {
		const id = page.params.id!;
		loading = true;
		loadError = null;
		notFound = false;
		try {
			user = await usersApi.get(id);
		} catch (e) {
			if (e instanceof ApiError && e.status === 404) notFound = true;
			else loadError = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้';
		} finally {
			loading = false;
		}
	}

	async function loadHistory() {
		const id = page.params.id!;
		historyLoading = true;
		historyError = null;
		try {
			history = await usersApi.adminParticipations(id);
		} catch (e) {
			historyError = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดประวัติกิจกรรมได้';
		} finally {
			historyLoading = false;
		}
	}

	onMount(() => {
		loadUser();
		loadHistory();
	});

	// ─── Actions ────────────────────────────────────────────────────────────
	function openEditDialog() {
		if (!user) return;
		editEmail = user.email;
		editOpen = true;
	}

	async function submitEdit() {
		if (!user || editSubmitting) return;
		const trimmed = editEmail.trim();
		if (!trimmed || !/^.+@.+\..+$/.test(trimmed)) {
			toast.error('รูปแบบอีเมลไม่ถูกต้อง');
			return;
		}
		if (trimmed === user.email) {
			editOpen = false;
			return;
		}
		editSubmitting = true;
		try {
			await usersApi.adminUpdate(user.id, { email: trimmed });
			toast.success('อัปเดตอีเมลสำเร็จ');
			editOpen = false;
			await loadUser();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'อัปเดตอีเมลไม่สำเร็จ');
		} finally {
			editSubmitting = false;
		}
	}

	function openResetDialog() {
		resetPassword = '';
		resetShow = false;
		resetOpen = true;
	}

	async function submitReset() {
		if (!user || resetSubmitting) return;
		if (resetPassword.length < 8) {
			toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
			return;
		}
		resetSubmitting = true;
		try {
			await usersApi.adminResetPassword(user.id, resetPassword);
			toast.success('รีเซ็ตรหัสผ่านสำเร็จ');
			resetOpen = false;
			resetPassword = '';
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
		} finally {
			resetSubmitting = false;
		}
	}

	async function toggleStatus() {
		if (!user || statusBusy) return;
		// Active → Suspended ; anything else → Active
		const next: 'active' | 'suspended' = user.status === 'active' ? 'suspended' : 'active';
		statusBusy = true;
		try {
			await usersApi.adminUpdate(user.id, { status: next });
			toast.success(next === 'active' ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับบัญชีแล้ว');
			await loadUser();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'เปลี่ยนสถานะไม่สำเร็จ');
		} finally {
			statusBusy = false;
		}
	}

	async function confirmDelete() {
		if (!user || deleting) return;
		deleting = true;
		try {
			await usersApi.adminDelete(user.id);
			toast.success('ลบบัญชีเรียบร้อย');
			await goto('/admin/users');
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ลบบัญชีไม่สำเร็จ');
			deleting = false;
		}
	}

	// ─── Helpers ────────────────────────────────────────────────────────────
	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateOnly(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			case 'suspended':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getStatusText(status: string): string {
		const map: Record<string, string> = {
			active: 'เปิดใช้งาน',
			inactive: 'ปิดใช้งาน',
			suspended: 'ระงับ'
		};
		return map[status] || status;
	}

	function getParticipationStatusInfo(status: string): {
		label: string;
		variant: 'default' | 'secondary' | 'destructive' | 'outline';
	} {
		switch (status) {
			case 'completed':
			case 'checked_out':
				return { label: 'เสร็จสิ้น', variant: 'default' };
			case 'checked_in':
				return { label: 'กำลังเข้าร่วม', variant: 'secondary' };
			case 'registered':
				return { label: 'ลงทะเบียน', variant: 'outline' };
			case 'no_show':
				return { label: 'ไม่เข้าร่วม', variant: 'destructive' };
			default:
				return { label: status, variant: 'outline' };
		}
	}

	const fullName = $derived(
		user ? `${user.prefix} ${user.first_name} ${user.last_name}`.trim() : ''
	);
	const initials = $derived(
		user ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase() : ''
	);
	const isActive = $derived(user?.status === 'active');
</script>

<MetaTags
	title={user ? fullName : 'รายละเอียดผู้ใช้'}
	description="ดูรายละเอียดและจัดการบัญชีผู้ใช้"
/>

<div class="space-y-6">
	<!-- Back -->
	<Button variant="ghost" size="sm" onclick={() => goto('/admin/users')} class="gap-1.5">
		<ArrowLeft class="size-4" />
		กลับไปรายชื่อผู้ใช้
	</Button>

	{#if loading}
		<Card>
			<CardHeader class="flex flex-row items-center gap-4">
				<Skeleton class="size-16 rounded-full" />
				<div class="flex-1 space-y-2">
					<Skeleton class="h-6 w-48" />
					<Skeleton class="h-4 w-64" />
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				{#each Array(6) as _}
					<Skeleton class="h-5 w-full" />
				{/each}
			</CardContent>
		</Card>
	{:else if notFound}
		<Card>
			<CardContent class="flex flex-col items-center gap-3 py-16 text-center">
				<UserIcon class="size-12 text-muted-foreground/50" />
				<div>
					<p class="text-lg font-medium">ไม่พบผู้ใช้</p>
					<p class="text-sm text-muted-foreground">ผู้ใช้คนนี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์ดู</p>
				</div>
				<Button variant="outline" onclick={() => goto('/admin/users')}>
					<ArrowLeft class="mr-2 size-4" />
					กลับไปรายชื่อผู้ใช้
				</Button>
			</CardContent>
		</Card>
	{:else if loadError}
		<Alert variant="destructive">
			<CircleAlert class="size-4" />
			<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<span>{loadError}</span>
				<Button size="sm" variant="outline" onclick={loadUser}>
					<RefreshCw class="mr-2 size-4" />
					ลองใหม่
				</Button>
			</AlertDescription>
		</Alert>
	{:else if user}
		<!-- Identity card -->
		<Card>
			<CardHeader class="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center">
				<div
					class="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
				>
					{initials}
				</div>
				<div class="min-w-0 flex-1 space-y-1">
					<div class="flex flex-wrap items-center gap-2">
						<CardTitle class="text-xl">{fullName}</CardTitle>
						<Badge variant={getStatusBadgeVariant(user.status)}>{getStatusText(user.status)}</Badge>
					</div>
					<p class="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Mail class="size-3.5" />
						<span class="truncate">{user.email}</span>
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onclick={openEditDialog}>
						<Pencil class="mr-1.5 size-3.5" />
						แก้ไขอีเมล
					</Button>
					<Button variant="outline" size="sm" onclick={openResetDialog}>
						<Key class="mr-1.5 size-3.5" />
						รีเซ็ตรหัสผ่าน
					</Button>
					<Button
						variant={isActive ? 'outline' : 'default'}
						size="sm"
						onclick={toggleStatus}
						disabled={statusBusy}
					>
						{#if statusBusy}
							<Loader class="mr-1.5 size-3.5 animate-spin" />
						{:else if isActive}
							<UserX class="mr-1.5 size-3.5" />
						{:else}
							<UserCheck class="mr-1.5 size-3.5" />
						{/if}
						{isActive ? 'ระงับ' : 'เปิดใช้งาน'}
					</Button>
					<Button variant="destructive" size="sm" onclick={() => (deleteOpen = true)}>
						<Trash2 class="mr-1.5 size-3.5" />
						ลบ
					</Button>
				</div>
			</CardHeader>
			<Separator />
			<CardContent class="grid gap-4 pt-6 sm:grid-cols-2">
				<div class="flex items-start gap-3">
					<IdCard class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">รหัสนักศึกษา</p>
						<code class="text-sm font-medium">{user.student_id}</code>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<BuildingIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">หน่วยงาน</p>
						<p class="text-sm font-medium">{user.organization_name ?? '-'}</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<School class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">ภาควิชา</p>
						<p class="text-sm font-medium">{user.department_name ?? '-'}</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<CalendarIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">สมัครสมาชิกเมื่อ</p>
						<p class="text-sm font-medium">{formatDate(user.created_at)}</p>
					</div>
				</div>
				<div class="flex items-start gap-3 sm:col-span-2">
					<Clock class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด</p>
						<p class="text-sm font-medium">{formatDate(user.last_login_at)}</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Activity stats -->
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">รายงานกิจกรรม</h2>
				<Button variant="outline" size="sm" onclick={loadHistory} disabled={historyLoading}>
					<RefreshCw class="mr-2 size-3.5 {historyLoading ? 'animate-spin' : ''}" />
					รีเฟรช
				</Button>
			</div>

			{#if historyLoading}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each Array(4) as _}
						<Skeleton class="h-24 w-full" />
					{/each}
				</div>
			{:else if historyError}
				<Alert variant="destructive">
					<CircleAlert class="size-4" />
					<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<span>{historyError}</span>
						<Button size="sm" variant="outline" onclick={loadHistory}>
							<RefreshCw class="mr-2 size-4" />
							ลองใหม่
						</Button>
					</AlertDescription>
				</Alert>
			{:else if history}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardContent class="flex items-center gap-3 p-4">
							<CalendarDays class="size-8 text-muted-foreground" />
							<div>
								<p class="text-2xl font-bold">{history.stats.total}</p>
								<p class="text-xs text-muted-foreground">กิจกรรมที่ลงทะเบียน</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent class="flex items-center gap-3 p-4">
							<CircleCheck class="size-8 text-green-600 dark:text-green-400" />
							<div>
								<p class="text-2xl font-bold">{history.stats.completed}</p>
								<p class="text-xs text-muted-foreground">เข้าร่วมเสร็จสิ้น</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent class="flex items-center gap-3 p-4">
							<School class="size-8 text-emerald-600 dark:text-emerald-400" />
							<div>
								<p class="text-2xl font-bold">{history.stats.faculty_hours}</p>
								<p class="text-xs text-muted-foreground">ชม. ระดับคณะ</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent class="flex items-center gap-3 p-4">
							<Award class="size-8 text-blue-600 dark:text-blue-400" />
							<div>
								<p class="text-2xl font-bold">{history.stats.university_hours}</p>
								<p class="text-xs text-muted-foreground">ชม. ระดับมหาวิทยาลัย</p>
							</div>
						</CardContent>
					</Card>
				</div>

				<!-- Activity history table -->
				<Card class="mt-4">
					<CardHeader>
						<CardTitle class="text-base">ประวัติกิจกรรมทั้งหมด</CardTitle>
					</CardHeader>
					<CardContent>
						{#if history.participations.length === 0}
							<div class="py-8 text-center text-sm text-muted-foreground">
								<CalendarDays class="mx-auto mb-2 size-10 text-muted-foreground/40" />
								ยังไม่มีประวัติการเข้าร่วมกิจกรรม
							</div>
						{:else}
							<div class="overflow-x-auto">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>กิจกรรม</Table.Head>
											<Table.Head>ระดับ</Table.Head>
											<Table.Head>ประเภท</Table.Head>
											<Table.Head class="text-right">ชั่วโมง</Table.Head>
											<Table.Head>วันที่</Table.Head>
											<Table.Head>สถานะ</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each history.participations as p (p.id)}
											{@const info = getParticipationStatusInfo(p.status)}
											<Table.Row>
												<Table.Cell>
													<div class="space-y-0.5">
														<p class="font-medium">{p.activity.title}</p>
														<p class="text-xs text-muted-foreground">{p.activity.organizer_name}</p>
														{#if p.activity.location}
															<p class="flex items-center gap-1 text-xs text-muted-foreground">
																<MapPin class="size-3" />
																{p.activity.location}
															</p>
														{/if}
													</div>
												</Table.Cell>
												<Table.Cell>
													<span class="text-sm">
														{p.activity.activity_level
															? getActivityLevelDisplayName(p.activity.activity_level)
															: '-'}
													</span>
												</Table.Cell>
												<Table.Cell>
													<span class="text-sm">
														{getActivityTypeDisplayName(p.activity.activity_type)}
													</span>
												</Table.Cell>
												<Table.Cell class="text-right font-medium">
													{p.activity.hours}
												</Table.Cell>
												<Table.Cell>
													<span class="text-sm text-muted-foreground">
														{formatDateOnly(p.activity.start_date)}
													</span>
												</Table.Cell>
												<Table.Cell>
													<Badge variant={info.variant}>{info.label}</Badge>
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</div>
						{/if}
					</CardContent>
				</Card>
			{/if}
		</div>
	{/if}
</div>

<!-- Edit Email Dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="max-w-[95vw] sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>แก้ไขอีเมล</Dialog.Title>
			<Dialog.Description>เปลี่ยนอีเมลที่ผู้ใช้ใช้เข้าสู่ระบบ</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-3"
			onsubmit={(e) => {
				e.preventDefault();
				submitEdit();
			}}
		>
			<div class="space-y-2">
				<Label for="edit-email">อีเมลใหม่</Label>
				<Input
					id="edit-email"
					type="email"
					bind:value={editEmail}
					placeholder="user@example.com"
					required
					disabled={editSubmitting}
				/>
			</div>
			<Dialog.Footer class="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					variant="outline"
					onclick={() => (editOpen = false)}
					disabled={editSubmitting}
				>
					ยกเลิก
				</Button>
				<Button type="submit" disabled={editSubmitting}>
					{#if editSubmitting}
						<Loader class="mr-2 size-4 animate-spin" />
						กำลังบันทึก...
					{:else}
						บันทึก
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Reset Password Dialog -->
<Dialog.Root bind:open={resetOpen}>
	<Dialog.Content class="max-w-[95vw] sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>รีเซ็ตรหัสผ่าน</Dialog.Title>
			<Dialog.Description>
				กำหนดรหัสผ่านใหม่ให้ผู้ใช้ ผู้ใช้ต้องเปลี่ยนรหัสด้วยตนเองหลังเข้าสู่ระบบ
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-3"
			onsubmit={(e) => {
				e.preventDefault();
				submitReset();
			}}
		>
			<div class="space-y-2">
				<Label for="reset-password">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</Label>
				<div class="relative">
					<Input
						id="reset-password"
						type={resetShow ? 'text' : 'password'}
						bind:value={resetPassword}
						placeholder="••••••••"
						required
						minlength={8}
						disabled={resetSubmitting}
						class="pr-10"
					/>
					<button
						type="button"
						class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onclick={() => (resetShow = !resetShow)}
						aria-label={resetShow ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
					>
						{#if resetShow}
							<EyeOff class="size-4" />
						{:else}
							<Eye class="size-4" />
						{/if}
					</button>
				</div>
			</div>
			<Dialog.Footer class="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					variant="outline"
					onclick={() => (resetOpen = false)}
					disabled={resetSubmitting}
				>
					ยกเลิก
				</Button>
				<Button type="submit" disabled={resetSubmitting}>
					{#if resetSubmitting}
						<Loader class="mr-2 size-4 animate-spin" />
						กำลังรีเซ็ต...
					{:else}
						รีเซ็ตรหัสผ่าน
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation -->
<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ลบบัญชีผู้ใช้</AlertDialog.Title>
			<AlertDialog.Description>
				คุณกำลังจะลบบัญชี <strong>{fullName}</strong>
				บัญชีจะถูกซ่อนจากระบบและไม่สามารถเข้าสู่ระบบได้อีก
				ประวัติการเข้าร่วมกิจกรรมยังคงอยู่ (ลบแบบ soft delete)
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={deleting}>ยกเลิก</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmDelete} disabled={deleting}>
				{#if deleting}
					<Loader class="mr-2 size-4 animate-spin" />
					กำลังลบ...
				{:else}
					<Trash2 class="mr-2 size-4" />
					ยืนยันลบ
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
