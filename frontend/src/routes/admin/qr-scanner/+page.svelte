<script lang="ts">
	import { onMount, untrack } from 'svelte';
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
		IconCheck,
		IconX,
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
			participant_count?: number;
			hours?: number;
			status?: string;
			faculty_id?: string;
			organizer?: string;
		}>;
		selectedActivityId?: string;
	};

	let { data }: { data: QRScannerPageData } = $props();

	// Component state
	let selectedActivityId = $state(untrack(() => data.selectedActivityId || ''));
	let selectedActivityOption = $state<{ value: string; label: string } | undefined>(undefined);
	let scannerActive = $state(false);
	let scannerStatus = $state<'idle' | 'requesting' | 'active' | 'error'>('idle');
	let manualParticipantCount = $state(0);

	// Use $derived for computed values to avoid circular dependencies
	const selectedActivity = $derived(
		selectedActivityId
			? data.activities?.find((a: any) => a.id === selectedActivityId) || null
			: null
	);

	// Use base participant count from activity data, plus any manual increments from scanning
	const currentParticipantCount = $derived(
		(selectedActivity?.participant_count || 0) + manualParticipantCount
	);

	// Track URL updates separately to prevent infinite loops
	let isUpdatingUrl = $state(false);
	let lastUrlActivityId = $state('');

	$effect(() => {
		// Only update URL if we're in browser and not currently updating URL
		if (browser && !isUpdatingUrl && selectedActivityId !== lastUrlActivityId) {
			// Use untrack to read current URL without creating reactive dependencies
			const currentUrlActivityId = untrack(() => {
				const url = new URL(window.location.href);
				return url.searchParams.get('activity_id') || '';
			});

			if (selectedActivityId !== currentUrlActivityId) {
				isUpdatingUrl = true;
				const url = new URL(window.location.href);

				if (selectedActivityId) {
					url.searchParams.set('activity_id', selectedActivityId);
				} else {
					url.searchParams.delete('activity_id');
				}

				goto(url.toString(), { replaceState: true, noScroll: true }).finally(() => {
					isUpdatingUrl = false;
				});
			}

			lastUrlActivityId = selectedActivityId;
		}
	});

	onMount(() => {
		// Initialize URL tracking state first to prevent URL updates during initialization
		const url = new URL(window.location.href);
		lastUrlActivityId = url.searchParams.get('activity_id') || '';

		if (data.selectedActivityId && (data.activities?.length || 0) > 0) {
			selectedActivityId = data.selectedActivityId;
			const activity = data.activities?.find((a: any) => a.id === selectedActivityId);
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
		// Reset manual participant count when changing activities
		manualParticipantCount = 0;
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
		// Removed toast - QRScanner component handles all notifications
	}

	function stopScanning() {
		scannerActive = false;
		// Removed toast - QRScanner component handles all notifications
	}

	function handleScanResult(result: { success: boolean; message?: string }, _qrData: string) {
		if (result.success) {
			// Increment manual participant count on successful check-in
			manualParticipantCount++;
			// Toast notification removed - QRScanner component handles notifications
		}
		// Error handling is done by QRScanner component
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
				<IconQrcode class="h-6 w-6" />
				ระบบสแกน QR Code
			</h1>
			<p class="text-muted-foreground">สแกน QR Code เพื่อบันทึกการเข้าร่วมกิจกรรม</p>
		</div>

		<Button variant="outline" onclick={() => goto('/admin')} class="w-full gap-2 sm:w-auto">
			<IconArrowBack class="h-4 w-4" />
			กลับหน้าหลัก
		</Button>
	</div>

	<!-- Admin Info -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconSettings class="h-5 w-5" />
				ข้อมูลผู้ดูแลระบบ
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
				<IconActivity class="h-5 w-5" />
				เลือกกิจกรรม
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4 p-4 lg:p-6">
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
							if (value && value !== selectedActivityId) {
								const activity = data.activities?.find((a: any) => a.id === value);
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
							<IconActivity class="h-5 w-5" />
							{selectedActivity.title}
						</h3>

						<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
							<div class="flex items-center gap-2">
								<IconBuilding class="h-4 w-4 text-muted-foreground" />
								<span>หน่วยงานผู้จัด: {selectedActivity.organizer || 'ไม่ระบุ'}</span>
							</div>

							<div class="flex items-center gap-2">
								<IconMapPin class="h-4 w-4 text-muted-foreground" />
								<span>{selectedActivity.location}</span>
							</div>

							<div class="flex items-center gap-2">
								<IconUsers class="h-4 w-4 text-muted-foreground" />
								<span>
									ผู้เข้าร่วม: {selectedActivity.participant_count || 0}
									{#if selectedActivity.max_participants}
										/ {selectedActivity.max_participants}
									{/if} คน
									{#if !selectedActivity.max_participants}
										(ไม่จำกัด)
									{/if}
								</span>
							</div>

							<div class="flex items-center gap-2">
								<IconCalendar class="h-4 w-4 text-muted-foreground" />
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

	<!-- Activity Statistics -->
	{#if selectedActivity}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconUsers class="h-5 w-5" />
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
		{#if !scannerActive}
			<Button
				onclick={startScanning}
				disabled={!selectedActivityId}
				class="flex items-center gap-2"
			>
				<IconQrcode class="h-5 w-5" />
				เริ่มสแกน QR Code
			</Button>
		{:else}
			<Button onclick={stopScanning} variant="outline" class="flex items-center gap-2">
				<IconX class="h-5 w-5" />
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
			<div class="space-y-3 text-sm text-muted-foreground">
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 h-4 w-4 text-green-600" />
					<span>เลือกกิจกรรมที่มีสถานะ "กำลังดำเนินการ" เท่านั้น</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 h-4 w-4 text-green-600" />
					<span
						>เลือกโหมดการสแกน: <strong>เช็คอิน</strong> สำหรับเข้าร่วม หรือ
						<strong>เช็คเอาท์</strong> สำหรับออกจากกิจกรรม (รองรับการเริ่มต้นด้วยโหมดใดก็ได้)</span
					>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 h-4 w-4 text-green-600" />
					<span>กดปุ่ม "เริ่มสแกน" เพื่อเปิดกล้อง</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 h-4 w-4 text-green-600" />
					<span>วาง QR Code ของนักศึกษาในกรอบที่กำหนด</span>
				</div>
				<div class="flex items-start gap-2">
					<IconCheck class="mt-0.5 h-4 w-4 text-green-600" />
					<span>ระบบจะบันทึกและแสดงผลการสแกนอัตโนมัติ พร้อมการแจ้งเตือนแบบเรียบง่าย</span>
				</div>

				<!-- New flexible flow control info -->
				<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
					<div class="mb-2 flex items-center gap-2 font-medium text-blue-800">
						<IconCheck class="size-4" />
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
