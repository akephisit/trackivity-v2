<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { useQRCode } from '$lib/qr/client';
	import { getPrefixLabel } from '$lib/schemas/auth';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import QRCodeGenerator from '$lib/components/qr/QRCodeGenerator.svelte';
	import {
		IconQrcode,
		IconRefresh,
		IconCopy,
		IconCheck,
		IconAlertCircle,
		IconShieldCheck,
		IconClock,
		IconInfoCircle
	} from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';

	const { qrCode, status: qrStatus, generate } = useQRCode();

	const user = $derived(authStore.user);

	let copied = $state(false);
	let refreshing = $state(false);

	// Countdown state (updated every second)
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

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
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

		return () => {
			if (countdownTimer) clearInterval(countdownTimer);
		};
	});

	async function copyQRData() {
		if (!$qrCode) return;
		try {
			await navigator.clipboard.writeText($qrCode.id);
			copied = true;
			toast.success('คัดลอก QR Code ID แล้ว');
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
			toast.success('รีเฟรช QR Code แล้ว');
		} catch (err) {
			toast.error(
				'ไม่สามารถรีเฟรช QR Code ได้: ' +
					(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ')
			);
		} finally {
			refreshing = false;
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'ready':
				return { variant: 'default' as const, text: 'พร้อมใช้', icon: IconShieldCheck };
			case 'generating':
				return { variant: 'secondary' as const, text: 'กำลังสร้าง', icon: IconClock };
			case 'expired':
				return { variant: 'destructive' as const, text: 'หมดอายุ', icon: IconAlertCircle };
			default:
				return { variant: 'outline' as const, text: 'ไม่พร้อม', icon: IconAlertCircle };
		}
	}
</script>

<svelte:head>
	<title>QR Code - Trackivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="mx-auto max-w-sm space-y-6 pt-2 sm:max-w-md sm:pt-6">
	<!-- Main ID Card -->
	<Card
		class="relative overflow-hidden border-2 shadow-lg sm:rounded-2xl {timeRemainingSeconds <= 60 &&
		$qrStatus === 'ready'
			? 'border-orange-500/30'
			: 'border-primary/20'} transition-colors duration-500"
	>
		<div
			class="absolute inset-x-0 top-0 h-3 {timeRemainingSeconds <= 60 && $qrStatus === 'ready'
				? 'bg-gradient-to-r from-orange-400 to-orange-600'
				: 'bg-gradient-to-r from-primary to-primary/60'}"
		></div>

		<CardContent class="p-6 pt-8">
			<!-- QR Code Interactive Area -->
			<div class="flex flex-col items-center justify-center space-y-6">
				{#if $qrStatus === 'ready' && $qrCode}
					<!-- The Code Box -->
					<div class="relative flex flex-col items-center">
						<div
							class="rounded-2xl border-[3px] bg-white p-4 shadow-sm {timeRemainingSeconds <= 60
								? 'border-orange-400'
								: 'border-transparent ring-1 ring-border'} transition-colors duration-500"
						>
							<QRCodeGenerator size="large" showStatus={false} />
						</div>

						<!-- Copy button floating minimal under QR -->
						<button
							onclick={copyQRData}
							disabled={copied}
							class="mt-3 flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:bg-muted active:scale-95"
						>
							{#if copied}
								<IconCheck class="size-3.5 text-green-500" />
								<span class="text-green-600">คัดลอกแล้ว</span>
							{:else}
								<IconCopy class="size-3.5" /> ID: {$qrCode.id}
							{/if}
						</button>
					</div>

					<!-- Timer Block -->
					<div
						class="flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-muted/30 px-4"
					>
						<IconClock
							class="size-[18px] {timeRemainingSeconds <= 60
								? 'animate-pulse text-orange-500'
								: 'text-primary'}"
						/>
						<span
							class="text-[15px] font-semibold tracking-wide {timeRemainingSeconds <= 60
								? 'text-orange-600'
								: 'text-primary'}"
							style="font-variant-numeric: tabular-nums;"
						>
							รีเฟรชใน {formatTimeRemaining(timeRemainingSeconds)}
						</span>
					</div>
				{:else if $qrStatus === 'generating'}
					<div class="flex h-[260px] flex-col items-center justify-center space-y-4">
						<IconQrcode class="size-16 animate-pulse text-muted-foreground/30" />
						<p class="text-sm font-medium text-muted-foreground">
							กำลังสร้าง QR Code ส่วนตัวของคุณ...
						</p>
					</div>
				{:else}
					<div class="flex h-[260px] flex-col items-center justify-center space-y-4 text-center">
						<div class="rounded-full bg-destructive/10 p-4">
							<IconAlertCircle class="size-10 text-destructive" />
						</div>
						<div class="space-y-1">
							<p class="font-bold text-destructive">QR Code ไม่พร้อมใช้งาน</p>
							<p class="text-sm text-muted-foreground">
								คิวอาร์โค้ดหมดอายุการใช้งานแล้ว<br />หรือเกิดข้อผิดพลาดในการโหลด
							</p>
						</div>
						<Button
							onclick={handleRefreshQR}
							disabled={refreshing}
							variant="default"
							class="mt-2 w-full font-medium"
						>
							<IconRefresh class="mr-2 size-4 {refreshing ? 'animate-spin' : ''}" /> กดเพื่อขอ QR Code
							ใหม่
						</Button>
					</div>
				{/if}
			</div>

			<!-- Divider -->
			<div class="relative my-6 flex w-full items-center justify-center">
				<div class="w-full border-t border-dashed"></div>
				<div
					class="absolute bg-card px-3 text-[10px] tracking-wider text-muted-foreground uppercase opacity-70"
				>
					ข้อมูลผู้ถือบัตร
				</div>
				<div
					class="absolute -left-8 size-4 rounded-full border border-r-0 bg-muted shadow-inner"
				></div>
				<div
					class="absolute -right-8 size-4 rounded-full border border-l-0 bg-muted shadow-inner"
				></div>
			</div>

			{#if user}
				<!-- User Identity -->
				<div class="flex flex-col items-center text-center">
					<h2 class="text-lg font-bold text-foreground">
						{getPrefixLabel(user.prefix)}{user.first_name}
						{user.last_name}
					</h2>
					<p class="mt-1 font-mono text-sm tracking-widest text-muted-foreground">
						{user.student_id}
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Minimal Action / Info -->
	<div class="flex flex-col space-y-3 pb-6">
		{#if $qrStatus === 'ready'}
			<Button
				variant="outline"
				size="lg"
				onclick={handleRefreshQR}
				disabled={refreshing}
				class="w-full bg-background/50 font-medium shadow-sm hover:bg-background"
			>
				<IconRefresh class="mr-2 size-5 {refreshing ? 'animate-spin' : ''}" /> สร้าง QR Code ใหม่อีกครั้ง
			</Button>
		{/if}

		<div class="rounded-xl border bg-card/50 px-4 py-3 text-sm text-muted-foreground shadow-sm">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
					<IconInfoCircle class="size-4" />
				</div>
				<div class="space-y-1">
					<p class="font-medium text-foreground">ข้อแนะนำการใช้งาน</p>
					<p class="text-[13px] leading-relaxed">
						กรุณาปรับความสว่างหน้าจอให้เพียงพอ นำ QR Code ให้เจ้าหน้าที่สแกนเพื่อเข้าร่วมกิจกรรม
						(รหัสจะถูกรีเฟรชอัตโนมัติทุก 3 นาที)
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
