<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import QrScannerLib from 'qr-scanner';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';

	import {
		IconCamera,
		IconCameraOff,
		IconReload,
		IconAlertTriangle,
		IconCheck,
		IconQrcode,
		IconX,
		IconUser,
		IconClock,
		IconShieldExclamation,
		IconUserX,
		IconUsers,
		IconQrcodeOff,
		IconShieldX,
		IconBuilding,
		IconClockX,
		IconUserCheck,
		IconInfoCircle
	} from '@tabler/icons-svelte';

	import {
		type QRScanResult,
		type StatusCode,
		type StatusCategory,
		processQRScanResult,
		getStatusConfig,
		playStatusSound,
		triggerStatusVibration,
		formatStatusDetails
	} from '$lib/utils/qr-status';

	interface ScanResult {
		success: boolean;
		message: string;
		user_name?: string;
		student_id?: string;
		participation_status?: string;
		checked_in_at?: string;
		category?: StatusCategory;
		statusCode?: StatusCode;
		details?: string[];
	}

	interface ScannedUser {
		user_name: string;
		student_id: string;
		participation_status: string;
		checked_in_at: string;
		timestamp: number;
	}

	// Props
	let {
		activity_id = '',
		isActive = false,
		showHistory = true,
		maxHistoryItems = 10,
		onScan = undefined,
		onError = undefined,
		onStatusChange = undefined,
		onStop = undefined,
		soundEnabled = true,
		vibrationEnabled = true
	}: {
		activity_id?: string;
		isActive?: boolean;
		showHistory?: boolean;
		maxHistoryItems?: number;
		onScan?: ((result: ScanResult, qrData: string) => void) | undefined;
		onError?: ((message: string) => void) | undefined;
		onStatusChange?: ((status: 'idle' | 'requesting' | 'active' | 'error') => void) | undefined;
		onStop?: (() => void) | undefined;
		soundEnabled?: boolean;
		vibrationEnabled?: boolean;
	} = $props();

	// DOM ref
	let videoElement = $state<HTMLVideoElement>();

	// qr-scanner instance
	let qrScanner: QrScannerLib | null = null;

	// Scanner state
	let cameraStatus = $state<'idle' | 'requesting' | 'active' | 'error'>('idle');
	let error = $state<string | null>(null);
	let scanHistory = $state<ScannedUser[]>([]);
	let isProcessingScan = $state(false);

	// Scan cooldown
	let lastScanTime = 0;
	let lastScannedQRData = '';
	const scanCooldown = 2000;

	// Status feedback
	let currentStatus = $state<QRScanResult | null>(null);
	let statusDisplayTimer = $state<NodeJS.Timeout | null>(null);
	let statusProgress = $state<number>(100);
	let statusProgressTimer = $state<NodeJS.Timeout | null>(null);
	let lastStatusHash = '';

	// Duplicate tracking
	let recentlyScannedUsers = $state<
		Map<string, { timestamp: number; scanMode: string; status: string }>
	>(new Map());
	let duplicateAttemptCount = $state<number>(0);

	// Scan mode
	let scanMode = $state<'checkin' | 'checkout'>('checkin');

	// Reactive: start/stop based on isActive prop
	$effect(() => {
		if (browser && isActive && activity_id && videoElement) {
			startScanner();
		} else if (browser && !isActive) {
			stopScanner();
		}
	});

	// Also react when videoElement becomes available
	$effect(() => {
		if (browser && isActive && activity_id && videoElement && cameraStatus === 'idle') {
			startScanner();
		}
	});

	onMount(() => {
		if (browser && isActive && activity_id) {
			// Will start once videoElement is bound
		}
	});

	onDestroy(() => {
		destroyScanner();
		clearStatusDisplay();
	});

	async function startScanner() {
		if (!browser || !activity_id || !videoElement) return;
		if (cameraStatus === 'requesting' || cameraStatus === 'active') return;

		cameraStatus = 'requesting';
		error = null;
		onStatusChange?.(cameraStatus);

		try {
			// Destroy existing instance first
			if (qrScanner) {
				qrScanner.destroy();
				qrScanner = null;
			}

			qrScanner = new QrScannerLib(videoElement, (result) => handleQrResult(result.data), {
				onDecodeError: () => {
					// Intentionally silent — fires constantly when no QR visible
				},
				highlightScanRegion: true,
				highlightCodeOutline: true,
				preferredCamera: 'environment', // Use back camera on mobile
				maxScansPerSecond: 10,
				calculateScanRegion: (video) => {
					// Scan a centered square region for better performance
					const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
					const scanRegionSize = Math.round(smallestDimension * 0.7);
					return {
						x: Math.round((video.videoWidth - scanRegionSize) / 2),
						y: Math.round((video.videoHeight - scanRegionSize) / 2),
						width: scanRegionSize,
						height: scanRegionSize
					};
				}
			});

			await qrScanner.start();

			cameraStatus = 'active';
			onStatusChange?.(cameraStatus);
		} catch (err: any) {
			console.error('QR Scanner start error:', err);
			const msg = getErrorMessage(err);
			error = msg;
			cameraStatus = 'error';
			onStatusChange?.(cameraStatus);
			onError?.(msg);
		}
	}

	function stopScanner() {
		if (qrScanner) {
			try {
				qrScanner.stop();
			} catch (e) {
				// ignore
			}
		}
		cameraStatus = 'idle';
		error = null;
		lastScannedQRData = '';
		onStatusChange?.(cameraStatus);
	}

	function destroyScanner() {
		if (qrScanner) {
			try {
				qrScanner.destroy();
			} catch (e) {
				// ignore
			}
			qrScanner = null;
		}
		cameraStatus = 'idle';
		onStatusChange?.(cameraStatus);
	}

	function getErrorMessage(err: any): string {
		const msg = err?.message || err?.toString() || '';
		if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
			return 'กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์';
		} else if (msg.includes('NotFound') || msg.includes('no camera')) {
			return 'ไม่พบกล้องในอุปกรณ์';
		} else if (msg.includes('NotReadable') || msg.includes('busy')) {
			return 'กล้องถูกใช้งานโดยแอปพลิเคชันอื่น โปรดปิดแอปอื่นและลองใหม่';
		}
		return `ไม่สามารถเข้าถึงกล้องได้: ${msg || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}`;
	}

	async function handleQrResult(qrData: string) {
		if (isProcessingScan) return;

		const now = Date.now();

		// Cooldown: same QR within 2 seconds → skip
		if (qrData === lastScannedQRData && now - lastScanTime < scanCooldown) return;
		// Global cooldown between any scans
		if (now - lastScanTime < 1000) return;

		// Validate QR
		if (!isValidQRCode(qrData)) {
			handleInvalidCode(qrData, now);
			return;
		}

		isProcessingScan = true;
		lastScanTime = now;
		lastScannedQRData = qrData;

		try {
			const response = await fetch(`/api/activities/${activity_id}/${scanMode}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ qr_data: qrData })
			});

			const result = await response.json();
			const processedResult = processQRScanResult(result);
			displayStatus(processedResult);

			if (processedResult.success && processedResult.data) {
				const scanResult: ScanResult = {
					success: true,
					message: processedResult.message,
					user_name: processedResult.data.user_name,
					student_id: processedResult.data.student_id,
					participation_status: processedResult.data.participation_status,
					checked_in_at: processedResult.data.checked_in_at || processedResult.data.checked_out_at,
					category: processedResult.category,
					statusCode: scanMode === 'checkin' ? 'CHECKIN_SUCCESS' : 'CHECKOUT_SUCCESS'
				};

				if (scanResult.user_name && scanResult.student_id) {
					scanHistory = [
						{
							user_name: scanResult.user_name,
							student_id: scanResult.student_id,
							participation_status:
								scanResult.participation_status ||
								(scanMode === 'checkin' ? 'checked_in' : 'checked_out'),
							checked_in_at: scanResult.checked_in_at || new Date().toISOString(),
							timestamp: now
						},
						...scanHistory.slice(0, maxHistoryItems - 1)
					];
				}

				onScan?.(scanResult, qrData);
			} else {
				onScan?.(
					{
						success: false,
						message: processedResult.message,
						category: processedResult.category,
						statusCode: processedResult.error?.code
					},
					qrData
				);
			}
		} catch (err) {
			console.error('Scan error:', err);
			const errorResult = processQRScanResult({
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
					category: 'error'
				}
			});
			displayStatus(errorResult);
			onError?.(errorResult.message);
		} finally {
			isProcessingScan = false;
		}
	}

	// ─── QR Validation ──────────────────────────────────────────────────────────

	function isValidQRCode(qrData: string): boolean {
		if (!qrData || typeof qrData !== 'string' || qrData.length < 10) return false;
		if (!browser) return false;

		// 1. JWT token format (xxxx.yyyy.zzzz) — backend generates this
		const parts = qrData.split('.');
		if (parts.length === 3) {
			try {
				const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
				const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
				const payload = JSON.parse(atob(padded));
				if (payload?.sub) return true;
			} catch {
				// not JWT
			}
		}

		// 2. Base64 encoded JSON with uid/sub/user_id
		try {
			const obj = JSON.parse(atob(qrData));
			if (obj && (obj.uid || obj.sub || obj.user_id)) return true;
		} catch {}

		// 3. Direct JSON
		try {
			const obj = JSON.parse(qrData);
			if (obj && (obj.uid || obj.sub || obj.user_id)) return true;
		} catch {}

		// Reject pure numeric barcodes
		if (/^\d+$/.test(qrData)) return false;

		return false;
	}

	let lastInvalidScanTime = 0;
	let invalidScansCount = $state(0);

	function handleInvalidCode(data: string, timestamp: number) {
		if (timestamp - lastInvalidScanTime < 3000) return;
		lastInvalidScanTime = timestamp;
		invalidScansCount++;

		const message = /^\d+$/.test(data)
			? 'ตรวจพบบาร์โค้ด กรุณาสแกน QR Code เท่านั้น'
			: 'รูปแบบ QR Code ไม่ถูกต้อง';

		displayStatus({
			success: false,
			message,
			category: 'error',
			error: { code: 'QR_INVALID', message, category: 'error' }
		});
	}

	// ─── Status Display ─────────────────────────────────────────────────────────

	function displayStatus(result: QRScanResult) {
		const now = Date.now();
		const isDuplicateSuccess =
			result.success && result.data && (result.data as any).is_duplicate === true;

		if (isDuplicateSuccess) {
			duplicateAttemptCount = (duplicateAttemptCount || 0) + 1;
			if (duplicateAttemptCount > 2) {
				result = {
					...result,
					message: `${result.message} (สแกนซ้ำ ${duplicateAttemptCount} ครั้ง)`
				};
			}
		}

		if (result.data?.student_id) {
			recentlyScannedUsers.set(result.data.student_id, {
				timestamp: now,
				scanMode,
				status: result.success ? 'SUCCESS' : result.error?.code || 'ERROR'
			});
			// Clean old entries
			for (const [id, data] of recentlyScannedUsers.entries()) {
				if (now - data.timestamp > 120000) recentlyScannedUsers.delete(id);
			}
		}

		const statusHash = JSON.stringify({
			success: result.success,
			message: result.message,
			errorCode: result.error?.code,
			userData: result.data?.student_id,
			duplicateCount: duplicateAttemptCount
		});

		if (statusHash === lastStatusHash) return;

		clearStatusDisplay();
		currentStatus = result;
		lastStatusHash = statusHash;

		const statusCode =
			result.error?.code ||
			(result.success
				? scanMode === 'checkin'
					? 'CHECKIN_SUCCESS'
					: 'CHECKOUT_SUCCESS'
				: 'INTERNAL_ERROR');
		const config = getStatusConfig(statusCode);
		const displayDuration = isDuplicateSuccess
			? Math.min(config.duration, 2500)
			: Math.min(config.duration, 4000);

		if (soundEnabled) playStatusSound(statusCode);
		if (vibrationEnabled) triggerStatusVibration(statusCode);

		statusProgress = 100;
		statusProgressTimer = setInterval(() => {
			statusProgress -= 100 / (displayDuration / 100);
			if (statusProgress <= 0) clearStatusDisplay();
		}, 100);

		statusDisplayTimer = setTimeout(() => clearStatusDisplay(), displayDuration);

		if (!isDuplicateSuccess) duplicateAttemptCount = 0;
	}

	function clearStatusDisplay() {
		if (statusDisplayTimer) {
			clearTimeout(statusDisplayTimer);
			statusDisplayTimer = null;
		}
		if (statusProgressTimer) {
			clearInterval(statusProgressTimer);
			statusProgressTimer = null;
		}
		currentStatus = null;
		statusProgress = 100;
		setTimeout(() => {
			lastStatusHash = '';
		}, 1000);
	}

	// ─── Status Icons ────────────────────────────────────────────────────────────

	function getStatusIcon(statusCode: StatusCode) {
		const iconMap: Record<StatusCode, any> = {
			CHECKIN_SUCCESS: IconCheck,
			CHECKOUT_SUCCESS: IconCheck,
			ALREADY_CHECKED_IN: IconInfoCircle,
			ALREADY_CHECKED_OUT: IconInfoCircle,
			ALREADY_COMPLETED: IconInfoCircle,
			REPEATED_DUPLICATE_ATTEMPT: IconAlertTriangle,
			FACULTY_RESTRICTION: IconShieldExclamation,
			ACTIVITY_NOT_ONGOING: IconClock,
			ACTIVITY_EXPIRED: IconClockX,
			ACTIVITY_NOT_STARTED: IconClock,
			MAX_PARTICIPANTS_REACHED: IconUsers,
			NOT_CHECKED_IN: IconUserCheck,
			NOT_CHECKED_IN_YET: IconUserCheck,
			STUDENT_ACCOUNT_INACTIVE: IconUserX,
			QR_EXPIRED: IconQrcodeOff,
			INVALID_CHECKOUT_STATUS: IconX,
			ACTIVITY_NOT_FOUND: IconAlertTriangle,
			STUDENT_NOT_FOUND: IconUserX,
			QR_INVALID: IconQrcodeOff,
			DEPARTMENT_NOT_FOUND: IconBuilding,
			NO_DEPARTMENT: IconBuilding,
			AUTH_ERROR: IconShieldX,
			VALIDATION_ERROR: IconAlertTriangle,
			INTERNAL_ERROR: IconAlertTriangle
		};
		return iconMap[statusCode] || IconAlertTriangle;
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────────

	function clearHistory() {
		scanHistory = [];
	}

	function formatDateTime(dateString: string): string {
		try {
			return new Date(dateString).toLocaleString('th-TH', {
				year: '2-digit',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'ไม่ระบุ';
		}
	}

	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status.toLowerCase()) {
			case 'checked_in':
			case 'checkedin':
				return 'default';
			case 'checked_out':
			case 'checkedout':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function getStatusText(status: string): string {
		switch (status.toLowerCase()) {
			case 'checked_in':
			case 'checkedin':
				return 'เข้าร่วมแล้ว';
			case 'checked_out':
			case 'checkedout':
				return 'ออกจากกิจกรรมแล้ว';
			case 'registered':
				return 'ลงทะเบียนแล้ว';
			default:
				return status;
		}
	}

	function handleStopClick() {
		if (onStop) {
			onStop();
		} else {
			stopScanner();
		}
	}
</script>

<div class="space-y-4">
	<!-- Scanner Card -->
	<Card class="w-full">
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<IconQrcode class="size-5" />
					QR Scanner
				</div>

				<div class="flex items-center gap-2">
					<Badge
						variant={cameraStatus === 'active'
							? 'default'
							: cameraStatus === 'error'
								? 'destructive'
								: 'secondary'}
					>
						{#if cameraStatus === 'requesting'}
							<IconCamera class="mr-1 size-3 animate-pulse" />
							กำลังเชื่อมต่อ...
						{:else if cameraStatus === 'active'}
							<div class="mr-1 h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
							พร้อมสแกน
						{:else if cameraStatus === 'error'}
							<IconCameraOff class="mr-1 size-3" />
							ข้อผิดพลาด
						{:else}
							<IconCameraOff class="mr-1 size-3" />
							ปิด
						{/if}
					</Badge>

					{#if isProcessingScan}
						<Badge variant="secondary">
							<IconReload class="mr-1 size-3 animate-spin" />
							กำลังประมวลผล...
						</Badge>
					{/if}
				</div>
			</CardTitle>
		</CardHeader>

		<CardContent class="space-y-4">
			<!-- Camera Preview -->
			<div class="relative">
				<div
					class="relative overflow-hidden rounded-xl border-2 bg-black"
					style="aspect-ratio: 4/3; max-height: 500px;"
					id="video-container"
				>
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={videoElement}
						class="absolute inset-0 h-full w-full object-cover"
						playsinline
						muted
						autoplay
					></video>

					<!-- Overlay shown when not active -->
					{#if cameraStatus !== 'active' && cameraStatus !== 'requesting'}
						<div class="absolute inset-0 flex items-center justify-center bg-black/70">
							<div class="space-y-3 text-center text-white">
								{#if cameraStatus === 'error'}
									<IconCameraOff class="mx-auto size-14 text-red-400" />
									<p class="text-sm font-medium text-red-300">ไม่สามารถเข้าถึงกล้องได้</p>
								{:else}
									<IconCamera class="mx-auto size-14 text-gray-400" />
									<p class="text-sm text-gray-300">กดปุ่มเริ่มสแกนเพื่อเปิดกล้อง</p>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Loading overlay -->
					{#if cameraStatus === 'requesting'}
						<div class="absolute inset-0 flex items-center justify-center bg-black/60">
							<div class="text-center text-white">
								<div
									class="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent"
								></div>
								<p class="text-sm">กำลังเปิดกล้อง...</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Error Alert -->
			{#if error}
				<Alert variant={cameraStatus === 'error' ? 'destructive' : 'default'}>
					<IconAlertTriangle class="h-4 w-4" />
					<AlertDescription class="space-y-3">
						<div>{error}</div>
						{#if cameraStatus === 'error'}
							<div class="space-y-2">
								<Button size="sm" onclick={() => startScanner()}>
									<IconReload class="mr-2 h-3 w-3" />
									ลองใหม่
								</Button>
								<div class="mt-2 text-sm text-muted-foreground">
									<ul class="list-inside list-disc space-y-1 text-xs">
										{#if error.includes('อนุญาต')}
											<li>คลิกไอคอนกล้องในแถบที่อยู่ของเบราว์เซอร์และเลือก "อนุญาต"</li>
											<li>รีเฟรชหน้าเว็บและลองใหม่</li>
										{:else if error.includes('ถูกใช้งาน')}
											<li>ปิดแอปหรือแท็บอื่นที่อาจใช้กล้อง</li>
											<li>รีสตาร์ทเบราว์เซอร์และลองใหม่</li>
										{:else}
											<li>รีเฟรชหน้าเว็บและลองใหม่</li>
											<li>ลองใช้เบราว์เซอร์อื่น (Chrome, Safari)</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Status Display -->
			{#if currentStatus}
				{@const statusCode =
					currentStatus.error?.code ||
					(currentStatus.success ? 'CHECKIN_SUCCESS' : 'INTERNAL_ERROR')}
				{@const config = getStatusConfig(statusCode)}
				{@const StatusIcon = getStatusIcon(statusCode)}

				<div
					class="relative overflow-hidden rounded-lg border-2 {config.borderColor} {config.bgColor} p-4 transition-all duration-300"
				>
					<!-- Progress bar -->
					<div
						class="absolute top-0 left-0 h-1 {config.borderColor.replace(
							'border-',
							'bg-'
						)} transition-all duration-100"
						style="width: {statusProgress}%"
					></div>

					<div class="flex items-start gap-3">
						<div class="flex-shrink-0 {config.iconColor}">
							<StatusIcon class="size-6" />
						</div>

						<div class="min-w-0 flex-1">
							<div class="font-medium {config.color} mb-1">{currentStatus.message}</div>

							{#if currentStatus.success && currentStatus.data}
								<div class="text-sm {config.color.replace('700', '600')} space-y-1">
									{#if currentStatus.data.user_name}
										<div class="flex items-center gap-2">
											<IconUser class="size-4" />
											<span>{currentStatus.data.user_name}</span>
											{#if currentStatus.data.student_id}
												<span class="text-xs opacity-75">({currentStatus.data.student_id})</span>
											{/if}
										</div>
									{/if}
									{#if currentStatus.data.checked_in_at || currentStatus.data.checked_out_at}
										<div class="flex items-center gap-2">
											<IconClock class="size-4" />
											<span class="text-xs">
												{new Date(
													currentStatus.data.checked_in_at ||
														currentStatus.data.checked_out_at ||
														''
												).toLocaleString('th-TH', {
													day: '2-digit',
													month: '2-digit',
													hour: '2-digit',
													minute: '2-digit'
												})}
											</span>
										</div>
									{/if}
								</div>
							{/if}

							{#if currentStatus.error?.details && formatStatusDetails(currentStatus.error.details).length > 0}
								<div class="mt-2 text-xs {config.color.replace('700', '600')} space-y-1">
									{#each formatStatusDetails(currentStatus.error.details) as detail}
										<div class="flex items-start gap-2">
											<span class="text-xs opacity-50">•</span>
											<span>{detail}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<button
							onclick={clearStatusDisplay}
							class="flex-shrink-0 {config.color.replace('700', '400')} transition-colors"
							type="button"
						>
							<IconX class="size-4" />
						</button>
					</div>
				</div>
			{/if}

			<!-- Control Buttons -->
			<div class="flex flex-col items-center gap-3">
				<!-- Mode toggle -->
				<div class="inline-flex overflow-hidden rounded-md border bg-background">
					<button
						class={`px-4 py-2 text-sm font-medium transition-all duration-200 ${scanMode === 'checkin' ? 'bg-green-600 text-white shadow-md' : 'text-muted-foreground hover:bg-muted'}`}
						onclick={() => {
							scanMode = 'checkin';
							duplicateAttemptCount = 0;
							recentlyScannedUsers.clear();
						}}
						type="button"
						disabled={isProcessingScan}
					>
						<div class="flex items-center gap-2">
							{#if scanMode === 'checkin'}<div class="h-2 w-2 rounded-full bg-white"></div>{/if}
							เช็คอิน
						</div>
					</button>
					<button
						class={`px-4 py-2 text-sm font-medium transition-all duration-200 ${scanMode === 'checkout' ? 'bg-orange-600 text-white shadow-md' : 'text-muted-foreground hover:bg-muted'}`}
						onclick={() => {
							scanMode = 'checkout';
							duplicateAttemptCount = 0;
							recentlyScannedUsers.clear();
						}}
						type="button"
						disabled={isProcessingScan}
					>
						<div class="flex items-center gap-2">
							{#if scanMode === 'checkout'}<div class="h-2 w-2 rounded-full bg-white"></div>{/if}
							เช็คเอาท์
						</div>
					</button>
				</div>

				<!-- Mode indicator -->
				<div class="text-center text-xs text-muted-foreground">
					{#if scanMode === 'checkin'}
						<span class="text-green-600">โหมดเช็คอิน - สำหรับการเข้าร่วมกิจกรรม</span>
					{:else}
						<span class="text-orange-600">โหมดเช็คเอาท์ - สำหรับการออกจากกิจกรรม</span>
					{/if}
				</div>

				<!-- Camera controls -->
				<div class="flex items-center justify-center gap-3">
					{#if cameraStatus === 'idle' || cameraStatus === 'error'}
						<Button
							onclick={() => startScanner()}
							disabled={!activity_id}
							class="px-6 py-2 font-medium"
						>
							<IconCamera class="mr-2 size-4" />
							เริ่มสแกน
						</Button>
					{:else if cameraStatus === 'active' || cameraStatus === 'requesting'}
						<Button onclick={handleStopClick} variant="outline" class="px-6 py-2 font-medium">
							<IconCameraOff class="mr-2 size-4" />
							หยุดสแกน
						</Button>

						{#if duplicateAttemptCount > 0}
							<Button
								onclick={() => {
									duplicateAttemptCount = 0;
									recentlyScannedUsers.clear();
									clearStatusDisplay();
								}}
								variant="ghost"
								size="sm"
								class="text-orange-600 hover:text-orange-800"
							>
								<IconReload class="mr-1 size-3" />
								รีเซ็ตการแจ้งเตือน
							</Button>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Scanner Info -->
			<div class="space-y-2 text-center text-xs text-muted-foreground">
				{#if !activity_id}
					<p class="text-destructive">กรุณาเลือกกิจกรรมก่อนเริ่มสแกน</p>
				{:else if cameraStatus === 'active'}
					<p>วาง QR Code ของนักศึกษาให้อยู่ในกรอบสีน้ำเงินเพื่อสแกน</p>
					{#if recentlyScannedUsers.size > 0}
						<div class="rounded-md border border-green-200 bg-green-50 p-2">
							<div class="text-xs text-green-700">
								✅ สแกนล่าสุด: {recentlyScannedUsers.size} คน
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</CardContent>
	</Card>

	<!-- Scan History -->
	{#if showHistory && scanHistory.length > 0}
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<CardTitle class="flex items-center gap-2">
						<IconUser class="size-5" />
						ประวัติการสแกน
						<Badge variant="outline">{scanHistory.length}</Badge>
					</CardTitle>
					<Button onclick={clearHistory} variant="outline" size="sm">
						<IconX class="mr-2 size-4" />
						ล้างประวัติ
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					{#each scanHistory as item, index (item.timestamp)}
						<div class="flex items-center justify-between rounded-lg bg-muted/50 p-3">
							<div class="flex-1">
								<div class="mb-1 flex items-center gap-2">
									<IconCheck class="size-4 text-green-600" />
									<span class="font-medium">{item.user_name}</span>
									<Badge variant={getStatusBadgeVariant(item.participation_status)} class="text-xs">
										{getStatusText(item.participation_status)}
									</Badge>
								</div>
								<div class="flex items-center gap-4 text-sm text-muted-foreground">
									<span>รหัส: {item.student_id}</span>
									<div class="flex items-center gap-1">
										<IconClock class="size-3" />
										{formatDateTime(item.checked_in_at)}
									</div>
								</div>
							</div>
						</div>
						{#if index < scanHistory.length - 1}<Separator />{/if}
					{/each}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
