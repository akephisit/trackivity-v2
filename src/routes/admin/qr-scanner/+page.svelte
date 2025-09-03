<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	// Removed toast import - QRScanner component handles all notifications

	import QRScanner from '$lib/components/qr/QRScanner.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';

	import {
		IconQrcode,
		IconActivity,
		IconUsers,
		IconMapPin,
		IconCalendar,
		IconClock,
		IconCheck,
		IconX,
		IconRefresh,
		IconSettings,
		IconArrowBack,
		IconBuilding
	} from '@tabler/icons-svelte';

	import type { PageData } from './$types';

	// Extend PageData with fields returned by this page's load
	type QRScannerPageData = PageData & {
		admin?: {
			first_name: string;
			last_name: string;
			admin_level: string;
			faculty_id?: string;
			faculty_name?: string;
		};
		activities?: Array<{
			id: string;
			title: string;
			description?: string;
			start_date?: string;
			end_date?: string;
			start_time?: string;
			end_time?: string;
			activity_type?: string;
			location?: string;
			max_participants?: number;
			hours?: number;
			status?: string;
			faculty_id?: string;
			organizer?: string;
		}>;
		selectedActivityId?: string;
	};

	let { data }: { data: QRScannerPageData } = $props();

	// Component state
	let selectedActivity = $state<any>(null);
	let selectedActivityId = $state(data.selectedActivityId || '');
	let selectedActivityOption = $state<{ value: string; label: string } | undefined>(undefined);
	let scannerActive = $state(false);
	let scannerStatus = $state<'idle' | 'requesting' | 'active' | 'error'>('idle');
	let totalScanned = $state(0);
	let sessionStats = $state({
		successful: 0,
		failed: 0,
		startTime: null as Date | null
	});

	// Reactive statements
	$effect(() => {
		if (selectedActivityId) {
			selectedActivity = data.activities?.find((a: any) => a.id === selectedActivityId) || null;
			// Update URL when activity changes (only in browser)
			if (browser) {
				const url = new URL(window.location.href);
				if (url.searchParams.get('activity_id') !== selectedActivityId) {
					url.searchParams.set('activity_id', selectedActivityId);
					goto(url.toString(), { replaceState: true, noScroll: true });
				}
			}
		} else {
			selectedActivity = null;
		}
	});

	onMount(() => {
		if (data.selectedActivityId && (data.activities?.length || 0) > 0) {
			selectedActivityId = data.selectedActivityId;
			const activity = data.activities?.find(a => a.id === selectedActivityId);
			if (activity) {
				selectedActivityOption = { value: activity.id, label: activity.title };
			}
		} else if ((data.activities?.length || 0) === 1) {
			// Auto-select if only one activity
			selectedActivityId = data.activities![0].id;
			selectedActivityOption = { value: data.activities![0].id, label: data.activities![0].title };
		}
	});

	function handleActivityChange(activityId: string) {
		selectedActivityId = activityId;
		// Stop scanner when changing activities
		if (scannerActive) {
			scannerActive = false;
		}
	}

	function startScanning() {
		if (!selectedActivityId) {
			// Removed toast - QRScanner component handles all notifications
			return;
		}

		scannerActive = true;
		sessionStats.startTime = new Date();
		// Removed toast - QRScanner component handles all notifications
	}

	function stopScanning() {
		scannerActive = false;
		// Removed toast - QRScanner component handles all notifications
	}

	function handleScanResult(result: any, _qrData: string) {
		totalScanned++;

		if (result.success) {
			sessionStats.successful++;
			// Toast notification removed - QRScanner component handles notifications
		} else {
			sessionStats.failed++;
			// Toast notification removed - QRScanner component handles notifications
		}
	}

	function handleScanError(_message: string) {
		sessionStats.failed++;
		// Toast notification removed - QRScanner component handles notifications
	}

	function handleStatusChange(status: typeof scannerStatus) {
		scannerStatus = status;
	}

	function resetStats() {
		sessionStats = {
			successful: 0,
			failed: 0,
			startTime: new Date()
		};
		totalScanned = 0;
		// Removed toast - QRScanner component handles all notifications
	}

	function formatDateTime(date: string | Date): string {
		try {
			const d = typeof date === 'string' ? new Date(date) : date;
			return d.toLocaleString('th-TH', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'ไม่ระบุ';
		}
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

	function formatDuration(start: Date): string {
		const now = new Date();
		const diff = now.getTime() - start.getTime();
		const minutes = Math.floor(diff / 60000);
		const seconds = Math.floor((diff % 60000) / 1000);
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	function getSuccessRate(): number {
		if (totalScanned === 0) return 0;
		return Math.round((sessionStats.successful / totalScanned) * 100);
	}
</script>

<svelte:head>
	<title>QR Scanner - Admin Dashboard</title>
	<meta name="description" content="ระบบสแกน QR Code สำหรับผู้ดูแลระบบ" />
</svelte:head>

<div class="container mx-auto max-w-4xl space-y-6 p-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				<IconQrcode class="size-6" />
				ระบบสแกน QR Code
			</h1>
			<p class="text-muted-foreground">สแกน QR Code เพื่อบันทึกการเข้าร่วมกิจกรรม</p>
		</div>

		<Button variant="outline" onclick={() => goto('/admin')}>
			<IconArrowBack class="mr-2 size-4" />
			กลับหน้าหลัก
		</Button>
	</div>

	<!-- Admin Info -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconSettings class="size-5" />
				ข้อมูลผู้ดูแลระบบ
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<p class="text-sm text-muted-foreground">ชื่อ</p>
					<p class="font-medium">{data.admin?.first_name} {data.admin?.last_name}</p>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">ระดับสิทธิ์</p>
					<Badge variant="outline">{data.admin?.admin_level}</Badge>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">หน่วยงาน</p>
					<p class="font-medium">{data.admin?.faculty_name || 'ทั้งหมด'}</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Activity Selection -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconActivity class="size-5" />
				เลือกกิจกรรม
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if (data.activities?.length || 0) === 0}
				<Alert>
					<IconX class="h-4 w-4" />
					<AlertDescription>
						ไม่พบกิจกรรมที่กำลังดำเนินการ (ongoing) ที่สามารถสแกน QR Code ได้ กรุณาติดต่อผู้ดูแลระบบ
					</AlertDescription>
				</Alert>
			{:else}
				<div class="space-y-2">
					<Label class="text-sm font-medium">
						เลือกกิจกรรมที่ต้องการสแกน (เฉพาะกิจกรรมที่กำลังดำเนินการ):
					</Label>
					<input type="hidden" bind:value={selectedActivityId} />
					<Select.Root
						type="single"
						bind:value={selectedActivityOption as any}
						onValueChange={(value) => {
							if (value) {
								selectedActivityId = value;
								const activity = data.activities?.find(a => a.id === value);
								if (activity) {
									selectedActivityOption = { value: activity.id, label: activity.title };
								}
								handleActivityChange(value);
							}
						}}
					>
						<Select.Trigger class="w-full">
							{selectedActivityOption?.label ?? 'เลือกกิจกรรม...'}
						</Select.Trigger>
						<Select.Content>
							{#each data.activities || [] as activity}
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
							<IconActivity class="size-5" />
							{selectedActivity.title}
						</h3>

						<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
							<div class="flex items-center gap-2">
								<IconBuilding class="size-4 text-muted-foreground" />
								<span>หน่วยงานผู้จัด: {selectedActivity.organizer || 'ไม่ระบุ'}</span>
							</div>

							<div class="flex items-center gap-2">
								<IconMapPin class="size-4 text-muted-foreground" />
								<span>{selectedActivity.location}</span>
							</div>

							<div class="flex items-center gap-2">
								<IconUsers class="size-4 text-muted-foreground" />
								<span>ผู้เข้าร่วมสูงสุด: {selectedActivity.max_participants || 'ไม่จำกัด'} คน</span>
							</div>

							<div class="flex items-center gap-2">
								<IconCalendar class="size-4 text-muted-foreground" />
								<span>
									{formatDate(selectedActivity.start_date)}
									{formatTime(selectedActivity.start_time)}
									- {formatDate(selectedActivity.end_date)}
									{formatTime(selectedActivity.end_time)}
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

	<!-- Session Statistics -->
	{#if sessionStats.startTime}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconClock class="size-5" />
					สถิติการสแกนในเซสชันนี้
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="text-center">
						<div class="text-2xl font-bold text-green-600">{sessionStats.successful}</div>
						<div class="text-sm text-muted-foreground">สำเร็จ</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-red-600">{sessionStats.failed}</div>
						<div class="text-sm text-muted-foreground">ไม่สำเร็จ</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold">{totalScanned}</div>
						<div class="text-sm text-muted-foreground">ทั้งหมด</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold">{getSuccessRate()}%</div>
						<div class="text-sm text-muted-foreground">อัตราสำเร็จ</div>
					</div>
				</div>

				<Separator class="my-4" />

				<div class="flex items-center justify-between text-sm">
					<span>เริ่มเซสชัน: {formatDateTime(sessionStats.startTime)}</span>
					<span>ระยะเวลา: {formatDuration(sessionStats.startTime)}</span>
				</div>

				<div class="mt-2">
					<Button onclick={resetStats} variant="outline" size="sm">
						<IconRefresh class="mr-2 size-4" />
						รีเซ็ตสถิติ
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Scanner Control -->
	<div class="flex justify-center gap-4">
		{#if !scannerActive}
			<Button
				onclick={startScanning}
				disabled={!selectedActivityId}
				class="flex items-center gap-2"
			>
				<IconQrcode class="size-5" />
				เริ่มสแกน QR Code
			</Button>
		{:else}
			<Button onclick={stopScanning} variant="outline" class="flex items-center gap-2">
				<IconX class="size-5" />
				หยุดสแกน
			</Button>
		{/if}
	</div>

	<!-- QR Scanner -->
	{#if scannerActive && selectedActivityId}
		<QRScanner
			activity_id={selectedActivityId}
			isActive={scannerActive}
			onScan={handleScanResult}
			onError={handleScanError}
			onStatusChange={handleStatusChange}
			showHistory={true}
			maxHistoryItems={20}
			soundEnabled={false}
			vibrationEnabled={true}
		/>
	{/if}

	<!-- Instructions -->
	<Card>
		<CardHeader>
			<CardTitle>คำแนะนำการใช้งาน</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-2 text-sm text-muted-foreground">
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 size-4 text-green-600" />
					<span>เลือกกิจกรรมที่มีสถานะ "กำลังดำเนินการ" เท่านั้น</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 size-4 text-green-600" />
					<span>กดปุ่ม "เริ่มสแกน QR Code" เพื่อเปิดกล้อง</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 size-4 text-green-600" />
					<span>วาง QR Code ของนักศึกษาในกรอบที่กำหนด</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 size-4 text-green-600" />
					<span>ระบบจะบันทึกการเข้าร่วมอัตโนมัติเมื่อตรวจพบ QR Code</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 size-4 text-green-600" />
					<span>ตรวจสอบสถิติและประวัติการสแกน - สามารถสแกนได้เฉพาะกิจกรรมที่กำลังดำเนินการ</span>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
