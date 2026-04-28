<script lang="ts">
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { Activity as ActivityIcon, CircleAlert, House, QrCode, RefreshCw, WifiOff } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	let isOnline = true;
	let retryCount = 0;
	let isRetrying = false;

	// Check online status
	onMount(() => {
		if (browser) {
			isOnline = navigator.onLine;

			const handleOnline = () => {
				isOnline = true;
				// Auto-redirect when back online
				setTimeout(() => {
					goto('/', { replaceState: true });
				}, 1000);
			};

			const handleOffline = () => {
				isOnline = false;
			};

			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			return () => {
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
			};
		}
	});

	async function handleRetry() {
		if (isRetrying) return;

		isRetrying = true;
		retryCount++;

		try {
			// Try to fetch a simple endpoint to check connectivity
			const response = await fetch('/', {
				method: 'HEAD',
				cache: 'no-cache'
			});

			if (response.ok) {
				goto('/', { replaceState: true });
			} else {
				throw new Error('Network request failed');
			}
		} catch (error) {
			console.error('Retry failed:', error);
			// Show error feedback
		} finally {
			isRetrying = false;
		}
	}

	function goHome() {
		goto('/');
	}
</script>

<MetaTags
	title="ออฟไลน์"
	description="ขณะนี้ออฟไลน์อยู่ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"
/>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<div class="w-full max-w-md space-y-6">
		<!-- Main Offline Card -->
		<Card class="text-center">
			<CardHeader class="pb-4">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
					<WifiOff class="size-8 text-muted-foreground" />
				</div>
				<CardTitle class="text-2xl">ไม่สามารถเชื่อมต่อได้</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-sm leading-relaxed text-muted-foreground">
					ขณะนี้ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อของคุณและลองใหม่อีกครั้ง
				</p>

				<!-- Connection Status -->
				<div class="flex justify-center">
					<Badge variant={isOnline ? 'default' : 'destructive'} class="text-xs">
						{isOnline ? '🟢 ออนไลน์' : '🔴 ออฟไลน์'}
					</Badge>
				</div>

				<!-- Action Buttons -->
				<div class="space-y-2">
					<Button onclick={handleRetry} disabled={isRetrying} class="w-full">
						{#if isRetrying}
							<RefreshCw class="mr-2 size-4 animate-spin" />
							กำลังลองใหม่...
						{:else}
							<RefreshCw class="mr-2 size-4" />
							ลองใหม่อีกครั้ง
						{/if}
					</Button>

					<Button variant="outline" onclick={goHome} class="w-full">
						<House class="mr-2 size-4" />
						กลับหน้าหลัก
					</Button>
				</div>

				{#if retryCount > 0}
					<p class="text-xs text-muted-foreground">
						ลองเชื่อมต่อแล้ว {retryCount} ครั้ง
					</p>
				{/if}
			</CardContent>
		</Card>

		<!-- Offline Features -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2 text-lg">
					<ActivityIcon class="size-5" />
					ฟีเจอร์ออฟไลน์
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="flex items-center gap-3 rounded bg-muted/50 p-2">
					<QrCode class="size-4 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">QR Code ส่วนตัว</p>
						<p class="text-xs text-muted-foreground">ดู QR Code ที่บันทึกไว้</p>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded bg-muted/50 p-2">
					<ActivityIcon class="size-4 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">ข้อมูลที่เคชไว้</p>
						<p class="text-xs text-muted-foreground">ดูกิจกรรมที่บันทึกไว้</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Tips -->
		<Alert>
			<CircleAlert class="size-4" />
			<AlertDescription class="text-sm">
				<strong>เคล็ดลับ:</strong> แอปจะกลับมาทำงานอัตโนมัติเมื่อการเชื่อมต่อกลับมาปกติ ข้อมูลที่ป้อนขณะออฟไลน์จะถูกซิงค์เมื่อเชื่อมต่อใหม่
			</AlertDescription>
		</Alert>
	</div>
</div>

<style>
	/* Offline page specific styles */
	@keyframes pulse-offline {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	:global(.offline-pulse) {
		animation: pulse-offline 2s ease-in-out infinite;
	}

	/* Better visibility for offline state */
	@media (prefers-color-scheme: dark) {
		:global(.offline-card) {
			background: hsl(220 13% 18%);
			border: 1px solid hsl(220 13% 25%);
		}
	}
</style>
