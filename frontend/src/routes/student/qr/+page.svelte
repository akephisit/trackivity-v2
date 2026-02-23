<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { useQRCode } from '$lib/qr/client';
	import { getPrefixLabel } from '$lib/schemas/auth';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import {
		IconQrcode,
		IconRefresh,
		IconCopy,
		IconCheck,
		IconAlertCircle,
		IconClock
	} from '@tabler/icons-svelte';

	const { qrCode, qrDataURL, status: qrStatus, generate } = useQRCode();

	const user = $derived(authStore.user);

	let copied = $state(false);
	let refreshing = $state(false);

	let timeRemainingSeconds = $state(0);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	function updateCountdown() {
		if (!$qrCode) {
			timeRemainingSeconds = 0;
			return;
		}
		const expiresAt = new Date($qrCode.expires_at).getTime();
		const remaining = Math.max(0, expiresAt - Date.now());
		timeRemainingSeconds = Math.floor(remaining / 1000);
	}

	function formatTimeRemaining(seconds: number): string {
		if (seconds <= 0) return 'หมดอายุแล้ว';
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

		return () => {
			if (countdownTimer) clearInterval(countdownTimer);
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
	class="flex h-[calc(100dvh-140px)] flex-col items-center justify-center overflow-hidden overscroll-none bg-muted/20 px-4 pb-2 sm:min-h-[calc(100vh-80px)] sm:items-start sm:justify-start sm:py-8"
>
	<!-- Main Card (Bank App Slip Style) -->
	<div
		class="w-full max-w-[360px] overflow-hidden rounded-[2rem] border border-border/50 bg-white shadow-xl sm:mt-4"
	>
		<!-- Brand Header -->
		<div class="relative bg-primary px-6 py-5 text-center text-primary-foreground">
			<!-- White curve at bottom -->
			<div class="absolute inset-x-0 -bottom-1 h-6 rounded-t-[1.5rem] border-none bg-white"></div>
			<div class="mb-5 flex items-center justify-center gap-2">
				<IconQrcode class="size-6" />
				<h2 class="flex items-center gap-1.5 text-[17px] font-bold tracking-wide">
					TRACKIVITY <span
						class="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-primary uppercase shadow-sm"
						>Pass</span
					>
				</h2>
			</div>
		</div>

		<!-- Card Content -->
		<div class="relative z-10 bg-white px-6 pb-8 text-center">
			<!-- User Info -->
			<div class="mb-7 space-y-1">
				<h3 class="text-[22px] leading-tight font-bold text-slate-800">
					{#if user}
						{getPrefixLabel(user.prefix)}{user.first_name} {user.last_name}
					{:else}
						ชื่อ-นามสกุล
					{/if}
				</h3>
				<p class="text-[15px] font-semibold text-slate-500">
					<span class="mr-2 text-sm text-slate-400">รหัสนักศึกษา</span>{user?.student_id || '-'}
				</p>
			</div>

			<!-- QR Code -->
			<div class="relative mx-auto mb-7 flex justify-center">
				{#if $qrStatus === 'ready' && $qrDataURL}
					<div
						class="relative rounded-[2rem] border-4 p-3 shadow-sm {timeRemainingSeconds <= 60
							? 'border-orange-400 bg-orange-50'
							: 'border-slate-100 bg-white'} transition-colors duration-500"
					>
						<img
							src={$qrDataURL}
							alt="QR Code"
							class="h-48 w-48 rounded-xl object-contain sm:h-56 sm:w-56 {timeRemainingSeconds <= 60
								? 'opacity-80'
								: 'opacity-100'} transition-opacity"
						/>
					</div>
				{:else if $qrStatus === 'generating' || $qrStatus === 'idle'}
					<div
						class="flex h-48 w-48 flex-col items-center justify-center rounded-[2rem] border-4 border-slate-100 bg-slate-50 sm:h-56 sm:w-56"
					>
						<IconQrcode class="size-12 animate-pulse text-slate-300" />
						<p class="mt-4 animate-pulse text-sm font-medium text-slate-400">กำลังโหลด...</p>
					</div>
				{:else}
					<div
						class="flex h-48 w-48 flex-col items-center justify-center rounded-[2rem] border-4 border-red-100 bg-red-50 p-4 text-red-500 sm:h-56 sm:w-56"
					>
						<IconAlertCircle class="mb-3 size-12" />
						<p class="text-sm font-bold">QR ไม่พร้อมใช้งาน</p>
						<Button
							onclick={handleRefreshQR}
							disabled={refreshing}
							variant="outline"
							class="mt-4 rounded-full border-red-200 bg-white text-red-600 hover:bg-red-50"
							size="sm"
						>
							กดเพื่อโหลดใหม่
						</Button>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			{#if $qrStatus === 'ready' && $qrCode}
				<!-- Timer -->
				<div
					class="mb-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
				>
					<div class="flex items-center gap-2.5">
						<div class="rounded-full bg-white p-1.5 shadow-sm">
							<IconClock
								class="size-4 {timeRemainingSeconds <= 60
									? 'animate-pulse text-orange-500'
									: 'text-slate-500'}"
							/>
						</div>
						<span
							class="text-[14.5px] font-medium {timeRemainingSeconds <= 60
								? 'text-orange-600'
								: 'text-slate-600'} tabular-nums"
						>
							รีเฟรชใน {formatTimeRemaining(timeRemainingSeconds)}
						</span>
					</div>
					<button
						onclick={handleRefreshQR}
						disabled={refreshing}
						class="rounded-full p-2 text-primary transition-colors hover:bg-primary/10 active:scale-95 disabled:opacity-50"
						title="รีเฟรช QR Code"
					>
						<IconRefresh class="size-[22px] {refreshing ? 'animate-spin' : ''}" />
					</button>
				</div>

				<!-- Copy ID -->
				<Button
					onclick={copyQRData}
					variant="ghost"
					class="h-[52px] w-full rounded-2xl border-2 border-slate-100 font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98]"
				>
					{#if copied}
						<IconCheck class="mr-2 size-5 text-green-500" />
						<span class="text-green-600">คัดลอกสำเร็จ</span>
					{:else}
						<IconCopy class="mr-2 size-5" /> คัดลอกรหัส (ID: {$qrCode.id.substring(0, 8)}...)
					{/if}
				</Button>
			{/if}

			<p class="mt-6 text-[13px] leading-relaxed font-medium text-slate-400">
				แสดง QR Code เพื่อเข้าร่วมกิจกรรม
			</p>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overscroll-behavior-y: none;
	}
</style>
