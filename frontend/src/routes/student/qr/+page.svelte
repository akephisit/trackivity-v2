<script lang="ts">
	import { CircleAlert, Check, Clock, Copy, QrCode, RefreshCw } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { useQRCode } from '$lib/qr/client';
	import { getPrefixLabel } from '$lib/schemas/auth';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	const { qrCode, qrDataURL, status: qrStatus, generate } = useQRCode();

	const user = $derived(authStore.user);

	let copied = $state(false);
	let refreshing = $state(false);
	let autoRefreshing = $state(false);

	let timeRemainingSeconds = $state(0);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let wakeLock: WakeLockSentinel | null = null;

	function updateCountdown() {
		if (!$qrCode) {
			timeRemainingSeconds = 0;
			return;
		}
		const expiresAt = new Date($qrCode.expires_at).getTime();
		const remaining = Math.max(0, expiresAt - Date.now());
		timeRemainingSeconds = Math.floor(remaining / 1000);

		// Belt-and-suspenders auto-refresh in case the QRClient timer
		// missed (e.g. tab was backgrounded past wake-up).
		if (timeRemainingSeconds === 0 && !autoRefreshing && $qrStatus === 'ready') {
			autoRefreshing = true;
			generate().catch(console.error).finally(() => {
				autoRefreshing = false;
			});
		}
	}

	function formatTimeRemaining(seconds: number): string {
		if (seconds <= 0) return 'หมดอายุแล้ว';
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}

	async function acquireWakeLock() {
		if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
			wakeLock.addEventListener('release', () => {
				wakeLock = null;
			});
		} catch {
			// User can revoke or browser can deny; that's fine — non-essential.
		}
	}

	function handleVisibility() {
		if (document.visibilityState === 'visible' && !wakeLock) {
			acquireWakeLock();
		}
	}

	$effect(() => {
		if ($qrCode) {
			updateCountdown();
		}
	});

	onMount(() => {
		countdownTimer = setInterval(() => {
			updateCountdown();
		}, 1000);

		if (user && $qrStatus === 'idle') {
			generate().catch(console.error);
		}

		acquireWakeLock();
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			if (countdownTimer) clearInterval(countdownTimer);
			document.removeEventListener('visibilitychange', handleVisibility);
			wakeLock?.release().catch(() => {});
			wakeLock = null;
		};
	});

	async function copyQRData() {
		if (!$qrCode) return;
		try {
			await navigator.clipboard.writeText($qrCode.id);
			copied = true;
			toast.success('คัดลอกรหัสประจำตัวสำเร็จ');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			toast.error('ไม่สามารถคัดลอกได้');
		}
	}

	async function handleRefreshQR() {
		refreshing = true;
		try {
			await generate();
			toast.success('รีเฟรช QR Code ใหม่แล้ว');
		} catch (err) {
			toast.error('เกิดข้อผิดพลาดในการโหลด QR Code');
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:head>
	<title>QR Code - Trackivity</title>
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
	/>
</svelte:head>

<div
	class="flex h-[calc(100dvh-140px)] flex-col items-center overflow-hidden overscroll-none px-4 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:h-auto sm:min-h-[calc(100vh-80px)] sm:justify-center sm:py-8"
>
	<!-- Main Card (Bank App Slip Style) -->
	<div
		class="w-full max-w-[360px] overflow-hidden rounded-[2rem] bg-white shadow-2xl select-none dark:bg-neutral-900"
	>
		<!-- Brand Header -->
		<div class="relative bg-primary px-6 py-5 text-center text-primary-foreground">
			<!-- White curve at bottom -->
			<div class="absolute inset-x-0 -bottom-1 h-6 rounded-t-[1.5rem] border-none bg-white dark:bg-neutral-900"></div>
			<div class="mb-5 flex items-center justify-center gap-2">
				<QrCode class="size-6" />
				<h2 class="flex items-center gap-1.5 text-[17px] font-bold tracking-wide">
					TRACKIVITY <span
						class="rounded-full bg-white dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-primary uppercase shadow-sm"
						>Pass</span
					>
				</h2>
			</div>
		</div>

		<!-- Card Content -->
		<div class="relative z-10 bg-white dark:bg-neutral-900 px-6 pb-8 text-center">
			<!-- User Info -->
			<div class="mb-7 space-y-1">
				<h3 class="text-[22px] leading-tight font-bold text-slate-800 dark:text-slate-200">
					{#if user}
						{getPrefixLabel(user.prefix)}{user.first_name} {user.last_name}
					{:else}
						ชื่อ-นามสกุล
					{/if}
				</h3>
				<p class="text-[15px] font-semibold text-slate-500 dark:text-slate-400">
					<span class="mr-2 text-sm text-slate-400 dark:text-slate-500">รหัสนักศึกษา</span>{user?.student_id || '-'}
				</p>
			</div>

			<!-- QR Code -->
			<div class="relative mx-auto mb-7 flex justify-center">
				{#if $qrStatus === 'ready' && $qrDataURL}
					<div
						class="relative rounded-[2rem] border-4 border-slate-100 dark:border-slate-900 bg-white dark:bg-neutral-900 p-3 shadow-sm transition-colors duration-500"
					>
						<img
							src={$qrDataURL}
							alt="QR Code"
							class="h-48 w-48 rounded-xl object-contain transition-opacity sm:h-56 sm:w-56"
						/>
					</div>
				{:else if $qrStatus === 'generating' || $qrStatus === 'idle'}
					<div
						class="flex h-48 w-48 flex-col items-center justify-center rounded-[2rem] border-4 border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/30 sm:h-56 sm:w-56"
					>
						<QrCode class="size-12 animate-pulse text-slate-300 dark:text-slate-600" />
						<p class="mt-4 animate-pulse text-sm font-medium text-slate-400 dark:text-slate-500">กำลังโหลด...</p>
					</div>
				{:else}
					<div
						class="flex h-48 w-48 flex-col items-center justify-center rounded-[2rem] border-4 border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-red-500 dark:text-red-400 sm:h-56 sm:w-56"
					>
						<CircleAlert class="mb-3 size-12" />
						<p class="text-sm font-bold">QR ไม่พร้อมใช้งาน</p>
						<Button
							onclick={handleRefreshQR}
							disabled={refreshing}
							variant="outline"
							class="mt-4 rounded-full border-red-200 dark:border-red-800 bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
							size="sm"
						>
							กดเพื่อโหลดใหม่
						</Button>
					</div>
				{/if}
			</div>

			<!-- Countdown -->
			{#if $qrStatus === 'ready' && $qrCode}
				{@const lowTime = timeRemainingSeconds > 0 && timeRemainingSeconds <= 30}
				<div
					class="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium tabular-nums {lowTime
						? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300'
						: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400'}"
					aria-live="polite"
				>
					<Clock class="size-4 {lowTime ? 'animate-pulse' : ''}" />
					{#if autoRefreshing || timeRemainingSeconds === 0}
						<span>กำลังต่ออายุ…</span>
					{:else}
						<span>หมดอายุใน {formatTimeRemaining(timeRemainingSeconds)}</span>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			{#if $qrStatus === 'ready' && $qrCode}
				<div class="flex gap-3">
					<!-- Copy ID -->
					<Button
						onclick={copyQRData}
						variant="ghost"
						class="h-[52px] flex-1 rounded-2xl border-2 border-slate-100 dark:border-slate-900 font-medium text-slate-500 dark:text-slate-400 transition-all hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:text-slate-800 dark:hover:text-slate-200 active:scale-[0.98]"
					>
						{#if copied}
							<Check class="mr-2 size-5 text-green-500 dark:text-green-400" />
							<span class="text-green-600 dark:text-green-400">คัดลอกสำเร็จ</span>
						{:else}
							<Copy class="mr-2 size-5" /> คัดลอกรหัสประจำตัว
						{/if}
					</Button>

					<!-- Refresh -->
					<Button
						onclick={handleRefreshQR}
						disabled={refreshing}
						variant="ghost"
						class="h-[52px] w-[52px] shrink-0 rounded-2xl border-2 border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400 transition-all hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:text-primary active:scale-[0.98]"
						title="โหลด QR ใหม่"
						aria-label="โหลด QR ใหม่"
					>
						<RefreshCw class="size-6 {refreshing ? 'animate-spin' : ''}" />
					</Button>
				</div>
			{/if}

			<p class="mt-6 text-xs leading-relaxed font-medium text-slate-400 dark:text-slate-500">
				แสดง QR Code นี้ให้เจ้าหน้าที่สแกนเพื่อเข้าร่วมกิจกรรม
			</p>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overscroll-behavior-y: none;
	}
</style>
