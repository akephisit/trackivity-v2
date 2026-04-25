<script lang="ts">
	import { Activity as ActivityIcon, Undo2, Building as BuildingIcon, Calendar as CalendarIcon, Check, CircleAlert, MapPin, QrCode, RefreshCw, Settings, Users, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import QRScanner from '$lib/components/qr/QRScanner.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { authStore } from '$lib/stores/auth.svelte';
	import { activities as activitiesApi, type Activity } from '$lib/api';

	const ADMIN_LEVEL_LABEL: Record<string, string> = {
		super_admin: 'ซุปเปอร์แอดมิน',
		organization_admin: 'แอดมินหน่วยงาน',
		regular_admin: 'แอดมินทั่วไป'
	};

	// Component state
	let activities = $state<Activity[]>([]);
	let selectedActivityId = $state('');
	let scannerActive = $state(false);
	let scannerMounted = $state(false);
	let scannerStatus = $state<'idle' | 'requesting' | 'active' | 'error'>('idle');
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);

	// Derived — no manual counter needed; backend sends real counts
	const selectedActivity = $derived(
		selectedActivityId ? activities.find((a) => a.id === selectedActivityId) || null : null
	);
	const currentParticipantCount = $derived(selectedActivity?.checked_in_count ?? 0);
	const isSuperAdmin = $derived(authStore.user?.admin_role?.admin_level === 'super_admin');

	// Sync activity_id with the URL via history.replaceState — simpler and
	// avoids the goto()/untrack/guard-flag dance that the previous version
	// needed to dodge SvelteKit's own re-navigations.
	$effect(() => {
		if (!browser) return;
		const url = new URL(window.location.href);
		const current = url.searchParams.get('activity_id') ?? '';
		if (current === selectedActivityId) return;
		if (selectedActivityId) {
			url.searchParams.set('activity_id', selectedActivityId);
		} else {
			url.searchParams.delete('activity_id');
		}
		history.replaceState(history.state, '', url);
	});

	async function loadActivities() {
		isLoading = true;
		loadError = null;
		try {
			const allActivities = await activitiesApi.list();
			activities = allActivities.filter((a) => a.status === 'ongoing');

			const urlActivityId = browser
				? new URL(window.location.href).searchParams.get('activity_id') ?? ''
				: '';

			if (urlActivityId && activities.some((a) => a.id === urlActivityId)) {
				selectedActivityId = urlActivityId;
			} else if (activities.length === 1) {
				// Auto-select if only one ongoing activity
				selectedActivityId = activities[0].id;
			}
		} catch (e: any) {
			loadError = e?.message ?? 'ไม่สามารถโหลดรายการกิจกรรมได้';
			console.error('Failed to load activities:', e);
		} finally {
			isLoading = false;
		}
	}

	onMount(loadActivities);

	function handleActivityChange(activityId: string) {
		selectedActivityId = activityId;
		if (scannerActive || scannerMounted) {
			scannerActive = false;
			setTimeout(() => {
				scannerMounted = false;
			}, 600);
		}
	}

	function startScanning() {
		if (!selectedActivityId) {
			return;
		}

		scannerActive = true;
		scannerMounted = true;
	}

	function stopScanning() {
		// First deactivate (stop camera) but keep mounted so QRScanner can cleanup gracefully
		scannerActive = false;
		// Then unmount after a short delay to allow camera cleanup to complete
		setTimeout(() => {
			scannerMounted = false;
		}, 600);
	}

	async function handleScanResult(result: { success: boolean; message?: string }, _qrData: string) {
		if (result.success && selectedActivityId) {
			// Refresh this activity's counts from backend
			try {
				const updated = await activitiesApi.get(selectedActivityId);
				activities = activities.map((a) => (a.id === selectedActivityId ? updated : a));
			} catch {
				// Ignore — count will refresh on next page load
			}
		}
	}

	function handleStatusChange(status: typeof scannerStatus) {
		scannerStatus = status;
	}

	function formatDate(dateString?: string): string {
		if (!dateString) return 'ไม่ระบุ';
		try {
			return new Date(dateString).toLocaleDateString('th-TH', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return 'ไม่ระบุ';
		}
	}

	function formatTime(timeString?: string): string {
		return timeString || 'ไม่ระบุ';
	}
</script>

<svelte:head>
	<title>QR Scanner - Trackivity</title>
	<meta name="description" content="ระบบสแกน QR Code สำหรับผู้ดูแลระบบ" />
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0 space-y-1">
			<h1 class="admin-page-title flex items-center gap-2">
				<QrCode class="h-6 w-6" />
				ระบบสแกน QR Code
			</h1>
			<p class="text-muted-foreground">สแกน QR Code เพื่อบันทึกการเข้าร่วมกิจกรรม</p>
		</div>

		<Button variant="outline" onclick={() => goto('/admin')} class="w-full gap-2 sm:w-auto">
			<Undo2 class="h-4 w-4" />
			กลับหน้าหลัก
		</Button>
	</div>

	<!-- Admin Info -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Settings class="h-5 w-5" />
				ข้อมูลผู้ดูแลระบบ
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div>
					<p class="text-sm text-muted-foreground">ชื่อ</p>
					<p class="font-medium">{authStore.user?.first_name} {authStore.user?.last_name}</p>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">ระดับสิทธิ์</p>
					<Badge variant="outline">
						{ADMIN_LEVEL_LABEL[authStore.user?.admin_role?.admin_level ?? ''] ?? 'ไม่ระบุ'}
					</Badge>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">หน่วยงาน</p>
					<p class="font-medium">
						{#if isSuperAdmin}
							<span class="text-muted-foreground italic">ทั้งหมด (ซุปเปอร์แอดมิน)</span>
						{:else if authStore.user?.organization_name || authStore.user?.department_name}
							{authStore.user?.organization_name || authStore.user?.department_name}
						{:else}
							<span class="text-muted-foreground italic">ไม่ระบุ</span>
						{/if}
					</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Activity Selection -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<ActivityIcon class="h-5 w-5" />
				เลือกกิจกรรม
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4 p-4 lg:p-6">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center gap-3 p-8">
					<div
						class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
					></div>
					<p class="text-sm text-muted-foreground">กำลังโหลดกิจกรรม...</p>
				</div>
			{:else if loadError}
				<Alert variant="destructive">
					<CircleAlert class="h-4 w-4" />
					<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<span>{loadError}</span>
						<Button size="sm" variant="outline" onclick={loadActivities}>
							<RefreshCw class="mr-2 size-4" />ลองใหม่
						</Button>
					</AlertDescription>
				</Alert>
			{:else if activities.length === 0}
				<Alert>
					<X class="h-4 w-4" />
					<AlertDescription>
						ไม่พบกิจกรรมที่กำลังดำเนินการ (ongoing) ที่สามารถสแกน QR Code ได้ กรุณาติดต่อผู้ดูแลระบบ
					</AlertDescription>
				</Alert>
			{:else}
				<div class="space-y-2">
					<Label class="text-sm font-medium">
						เลือกกิจกรรมที่ต้องการสแกน (เฉพาะกิจกรรมที่กำลังดำเนินการ):
					</Label>
					<Select.Root
						type="single"
						value={selectedActivityId}
						onValueChange={(value) => {
							if (value && value !== selectedActivityId) {
								handleActivityChange(value);
							}
						}}
					>
						<Select.Trigger class="w-full">
							{activities.find((a) => a.id === selectedActivityId)?.title ?? 'เลือกกิจกรรม...'}
						</Select.Trigger>
						<Select.Content>
							{#each activities as activity}
								<Select.Item value={activity.id}>
									{activity.title}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Selected Activity Info -->
				{#if selectedActivity}
					<div class="space-y-3 rounded-lg bg-muted/50 p-4">
						<h3 class="flex items-center gap-2 font-semibold">
							<ActivityIcon class="h-5 w-5" />
							{selectedActivity.title}
						</h3>

						<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
							<div class="flex items-center gap-2">
								<BuildingIcon class="h-4 w-4 text-muted-foreground" />
								<span>หน่วยงานผู้จัด: {selectedActivity.organizer_name || 'ไม่ระบุ'}</span>
							</div>

							<div class="flex items-center gap-2">
								<MapPin class="h-4 w-4 text-muted-foreground" />
								<span>{selectedActivity.location}</span>
							</div>

							<div class="flex items-center gap-2">
								<Users class="h-4 w-4 text-muted-foreground" />
								<span>
									ผู้เข้าร่วม: {selectedActivity.participant_count ?? 0}
									{#if selectedActivity.max_participants}
										/ {selectedActivity.max_participants} คน
									{:else}
										คน (ไม่จำกัด)
									{/if}
								</span>
							</div>

							<div class="flex items-center gap-2">
								<CalendarIcon class="h-4 w-4 text-muted-foreground" />
								<span>
									{formatDate(selectedActivity.start_date)}
									{formatTime(selectedActivity.start_time_only || undefined)}
									- {formatDate(selectedActivity.end_date)}
									{formatTime(selectedActivity.end_time_only || undefined)}
								</span>
							</div>

							<div class="flex items-center gap-2 md:col-span-2">
								<Badge variant="default" class="bg-green-600 hover:bg-green-700">
									<div class="flex items-center gap-1">
										<div class="h-2 w-2 animate-pulse rounded-full bg-white"></div>
										กำลังดำเนินการ
									</div>
								</Badge>
								<Badge variant="outline" class="border-green-600 text-green-600">สแกน QR ได้</Badge>
							</div>
						</div>

						{#if selectedActivity.description}
							<p class="text-sm text-muted-foreground">{selectedActivity.description}</p>
						{/if}
					</div>
				{/if}
			{/if}
		</CardContent>
	</Card>

	<!-- Activity Statistics -->
	{#if selectedActivity}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Users class="h-5 w-5" />
					สถิติกิจกรรม
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="text-center">
						<div class="text-3xl font-bold text-blue-600">{currentParticipantCount}</div>
						<div class="text-sm text-muted-foreground">จำนวนผู้เข้าร่วม</div>
					</div>
					<div class="text-center">
						<div class="text-3xl font-bold text-gray-600">
							{selectedActivity.max_participants || 'ไม่จำกัด'}
						</div>
						<div class="text-sm text-muted-foreground">จำนวนสูงสุด</div>
					</div>
				</div>

				{#if selectedActivity.max_participants && selectedActivity.max_participants > 0}
					<Separator class="my-4" />
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span>อัตราการเข้าร่วม:</span>
							<span class="font-medium">
								{Math.round((currentParticipantCount / selectedActivity.max_participants) * 100)}%
							</span>
						</div>
						<div class="h-2 w-full rounded-full bg-muted">
							<div
								class="h-2 rounded-full bg-blue-600 transition-all duration-300"
								style="width: {Math.min(
									(currentParticipantCount / selectedActivity.max_participants) * 100,
									100
								)}%"
							></div>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- Scanner Control -->
	<div class="flex justify-center gap-4">
		{#if !scannerMounted && !scannerActive}
			<Button
				onclick={startScanning}
				disabled={!selectedActivityId}
				class="flex items-center gap-2"
			>
				<QrCode class="h-5 w-5" />
				เริ่มสแกน QR Code
			</Button>
		{:else if scannerActive}
			<Button onclick={stopScanning} variant="outline" class="flex items-center gap-2">
				<X class="h-5 w-5" />
				หยุดสแกน
			</Button>
		{:else}
			<!-- Stopping in progress -->
			<Button disabled variant="outline" class="flex items-center gap-2">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				></div>
				กำลังหยุดสแกน...
			</Button>
		{/if}
	</div>

	<!-- QR Scanner -->
	{#if scannerMounted && selectedActivityId}
		<QRScanner
			activity_id={selectedActivityId}
			isActive={scannerActive}
			onScan={handleScanResult}
			onStatusChange={handleStatusChange}
			onStop={stopScanning}
			showHistory={true}
			maxHistoryItems={20}
			soundEnabled={true}
			vibrationEnabled={true}
		/>
	{/if}

	<!-- Instructions -->
	<Card>
		<CardHeader>
			<CardTitle>คำแนะนำการใช้งาน</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-3 text-sm text-muted-foreground">
				<div class="flex items-start gap-2">
					<Check class="mt-0.5 h-4 w-4 text-green-600" />
					<span>เลือกกิจกรรมที่มีสถานะ "กำลังดำเนินการ" เท่านั้น</span>
				</div>
				<div class="flex items-start gap-2">
					<Check class="mt-0.5 h-4 w-4 text-green-600" />
					<span
						>เลือกโหมดการสแกน: <strong>เช็คอิน</strong> สำหรับเข้าร่วม หรือ
						<strong>เช็คเอาท์</strong> สำหรับออกจากกิจกรรม (รองรับการเริ่มต้นด้วยโหมดใดก็ได้)</span
					>
				</div>
				<div class="flex items-start gap-2">
					<Check class="mt-0.5 h-4 w-4 text-green-600" />
					<span>กดปุ่ม "เริ่มสแกน" เพื่อเปิดกล้อง</span>
				</div>
				<div class="flex items-start gap-2">
					<Check class="mt-0.5 h-4 w-4 text-green-600" />
					<span>วาง QR Code ของนักศึกษาในกรอบที่กำหนด</span>
				</div>
				<div class="flex items-start gap-2">
					<Check class="mt-0.5 h-4 w-4 text-green-600" />
					<span>ระบบจะบันทึกและแสดงผลการสแกนอัตโนมัติ พร้อมการแจ้งเตือนแบบเรียบง่าย</span>
				</div>

				<!-- New flexible flow control info -->
				<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
					<div class="mb-2 flex items-center gap-2 font-medium text-blue-800">
						<Check class="size-4" />
						ระบบใหม่: การสแกนที่ยืดหยุ่นและใช้งานง่าย
					</div>
					<div class="space-y-2 text-xs text-blue-700">
						<div class="mb-1 font-medium text-blue-800">✅ สิ่งที่สามารถทำได้:</div>
						<p>• <strong>เริ่มต้นด้วยเช็คอิน:</strong> ยังไม่เริ่ม → เช็คอิน → เช็คเอาท์</p>
						<p>
							• <strong>เริ่มต้นด้วยเช็คเอาท์:</strong> ยังไม่เริ่ม → เช็คเอาท์ (สำหรับกิจกรรมที่ไม่ต้องการเช็คอิน)
						</p>
						<p>• <strong>เช็คอินซ้ำ:</strong> อนุญาตให้สแกนเช็คอินหลายครั้ง (แสดงผลสำเร็จ)</p>
						<p>• <strong>เช็คเอาท์ซ้ำ:</strong> อนุญาตให้สแกนเช็คเอาท์หลายครั้ง (แสดงผลสำเร็จ)</p>

						<div class="mt-2 mb-1 font-medium text-red-800">❌ ข้อจำกัดเดียว:</div>
						<p>
							• <strong>ห้ามย้อนกลับ:</strong> หลังเช็คเอาท์แล้วไม่สามารถเช็คอินอีกได้ (ป้องกันการไหลย้อนกลับ)
						</p>

						<div class="mt-2 mb-1 font-medium text-green-800">🎯 เป้าหมาย:</div>
						<p>• ลดการแจ้งเตือนที่น่ารำคาญ และทำให้ระบบใช้งานได้ง่ายขึ้น</p>
						<p>• รองรับกิจกรรมหลากหลายประเภท (บางกิจกรรมไม่ต้องการเช็คอิน)</p>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
