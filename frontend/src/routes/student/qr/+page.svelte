<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { useQRCode } from '$lib/qr/client';
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
		return `${minutes} นาที ${secs.toString().padStart(2, '0')} วินาที`;
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

<div class="space-y-6 p-4 sm:p-6">
	<!-- Header -->
	<div class="space-y-2 text-center">
		<h1 class="text-2xl font-bold lg:text-3xl">QR Code ของฉัน</h1>
		<p class="text-muted-foreground">ใช้ QR Code นี้ในการเข้าร่วมกิจกรรมต่างๆ</p>
	</div>

	<!-- User Info Card -->
	{#if user}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2 text-lg">
					<IconShieldCheck class="size-5" />
					ข้อมูลการระบุตัวตน
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
					<div>
						<span class="text-muted-foreground">ชื่อ:</span>
						<span class="ml-2 font-medium">
							{user.first_name}
							{user.last_name}
						</span>
					</div>
					<div>
						<span class="text-muted-foreground">รหัสนักศึกษา:</span>
						<span class="ml-2 font-medium">
							{user.student_id}
						</span>
					</div>
					<div class="sm:col-span-2">
						<span class="text-muted-foreground">อีเมล:</span>
						<span class="ml-2 font-medium">{user.email}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- QR Code Status -->
	{#if $qrStatus}
		{@const statusInfo = getStatusBadge($qrStatus)}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<IconQrcode class="size-5" />
						สถานะ QR Code
					</span>
					<Badge variant={statusInfo.variant}>
						<statusInfo.icon class="mr-1 size-3" />
						{statusInfo.text}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				{#if $qrCode && $qrStatus === 'ready'}
					<div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
						<div>
							<span class="text-muted-foreground">หมดอายุ:</span>
							<p class="mt-1 text-xs">
								{formatDate($qrCode.expires_at)}
							</p>
						</div>
						<div>
							<span class="text-muted-foreground">เวลาที่เหลือ:</span>
							<p
								class="mt-1 font-mono font-medium {timeRemainingSeconds <= 60
									? 'text-destructive'
									: 'text-primary'}"
							>
								{formatTimeRemaining(timeRemainingSeconds)}
							</p>
						</div>
					</div>

					<div class="flex flex-col gap-2 sm:flex-row">
						<Button
							variant="outline"
							size="sm"
							onclick={copyQRData}
							disabled={copied}
							class="flex-1 sm:flex-none"
						>
							{#if copied}
								<IconCheck class="mr-2 size-4" />
								คัดลอกแล้ว
							{:else}
								<IconCopy class="mr-2 size-4" />
								คัดลอก ID
							{/if}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={handleRefreshQR}
							disabled={refreshing}
							class="flex-1 sm:flex-none"
						>
							<IconRefresh class={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
							รีเฟรช
						</Button>
					</div>
				{:else if $qrStatus === 'generating'}
					<div class="flex items-center justify-center py-6">
						<div class="space-y-2 text-center">
							<IconClock class="mx-auto size-8 animate-pulse text-muted-foreground" />
							<p class="text-muted-foreground">กำลังสร้าง QR Code...</p>
						</div>
					</div>
				{:else}
					<Alert>
						<IconAlertCircle class="size-4" />
						<AlertDescription>
							QR Code ไม่พร้อมใช้งาน กรุณารอสักครู่หรือลองรีเฟรชหน้า
						</AlertDescription>
					</Alert>
					<Button onclick={handleRefreshQR} disabled={refreshing} class="w-full sm:w-auto">
						<IconRefresh class={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
						ลองอีกครั้ง
					</Button>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- QR Code Display -->
	{#if $qrCode && $qrStatus === 'ready'}
		<div class="flex justify-center">
			<QRCodeGenerator size="large" showStatus={false} />
		</div>
		<div class="space-y-1 text-center text-xs text-muted-foreground">
			<p>ID: <span class="font-mono">{$qrCode.id}</span></p>
			<p class="text-muted-foreground/70">แสดง QR Code นี้ให้เจ้าหน้าที่สแกนเพื่อเข้าร่วมกิจกรรม</p>
		</div>
	{/if}

	<!-- Instructions -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconInfoCircle class="size-5" />
				วิธีการใช้งาน
			</CardTitle>
		</CardHeader>
		<CardContent>
			<ol class="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
				<li>แสดง QR Code นี้ให้เจ้าหน้าที่ที่กิจกรรม</li>
				<li>เจ้าหน้าที่จะสแกน QR Code เพื่อบันทึกการเข้าร่วม</li>
				<li>QR Code มีอายุ 3 นาที และสร้างใหม่อัตโนมัติเพื่อความปลอดภัย</li>
				<li>คุณสามารถใช้ QR Code เดียวกันสำหรับกิจกรรมหลายๆ กิจกรรมได้</li>
				<li>หาก QR Code หมดอายุ กรุณากด "รีเฟรช" เพื่อสร้างใหม่</li>
			</ol>
		</CardContent>
	</Card>

	<!-- Mobile tips -->
	<Card class="border-primary/20 bg-primary/5 lg:hidden">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-sm text-primary">
				<IconInfoCircle class="size-4" />
				เคล็ดลับสำหรับมือถือ
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-1 text-xs text-muted-foreground">
			<p>• เพิ่มความสว่างของหน้าจอให้เต็มที่เมื่อแสดง QR Code</p>
			<p>• ถือโทรศัพท์ให้มั่นคงเมื่อเจ้าหน้าที่กำลังสแกน</p>
			<p>• QR Code จะหมดอายุทุก 3 นาที เพื่อป้องกันการปลอมแปลง</p>
		</CardContent>
	</Card>
</div>
