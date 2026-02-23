<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { IconDeviceMobile, IconShare, IconSquareRoundedPlus, IconX } from '@tabler/icons-svelte';
	import { Button } from '$lib/components/ui/button';

	let showPrompt = $state(false);
	let deferredPrompt = $state<any>(null);
	let isIOS = $state(false);
	let isStandalone = $state(true);

	onMount(() => {
		// 1. Check if already installed
		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches || // Standard
			(window.navigator as any).standalone === true || // iOS Safari Old
			document.referrer.includes('android-app://'); // Android

		if (isStandalone) return;

		// 2. Fallback check for Native Prompt on Android/Desktop Chrome
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e;
		});

		// 3. Check for iOS Device
		const userAgent = window.navigator.userAgent.toLowerCase();
		isIOS = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;

		// 4. Force show prompt after 1.5s on all devices
		setTimeout(() => {
			showPrompt = true;
		}, 1500);
	});

	async function installPWA() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				showPrompt = false;
			}
			deferredPrompt = null;
		} else {
			alert(
				'เบราว์เซอร์นี้ไม่รองรับปุ่มติดตั้งอัตโนมัติ\nกรุณากดที่เมนูของเบราว์เซอร์ (จุด 3 จุด หรือปุ่มแชร์)\nและเลือก "ติดตั้ง (Install)" หรือ "เพิ่มลงหน้าจอโฮม"'
			);
		}
	}

	function dismissPrompt() {
		showPrompt = false;
		localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
	}
</script>

{#if showPrompt}
	<div
		class="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm"
		in:slide={{ duration: 400, axis: 'y' }}
		out:fade={{ duration: 200 }}
	>
		<div
			class="relative overflow-hidden rounded-[1.5rem] border border-primary/20 bg-background/95 p-5 shadow-2xl backdrop-blur-xl supports-backdrop-filter:bg-background/80"
		>
			<!-- Close button -->
			<button
				onclick={dismissPrompt}
				class="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted focus:outline-none"
				aria-label="Close"
			>
				<IconX class="size-4" />
			</button>

			<div class="flex items-start gap-4">
				<div
					class="flex size-[48px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-primary text-white shadow-md"
				>
					<IconDeviceMobile class="size-6" />
				</div>

				<div class="flex-1 space-y-1">
					<h3 class="text-base leading-tight font-bold">เพิ่มเป็นแอปมือถือ</h3>

					{#if isIOS}
						<!-- iOS Instructions -->
						<p class="text-[13px] leading-snug text-muted-foreground">
							ติดตั้งลงหน้าจอโฮมเพื่อการใช้งานที่รวดเร็วกว่า แตะ
							<span
								class="inline-flex size-[22px] items-center justify-center rounded border bg-background align-middle shadow-sm"
							>
								<IconShare class="size-3.5 text-blue-500" />
							</span>
							ด้านล่างแล้วเลือก <br />
							<span class="mt-1 flex items-center gap-1 font-medium text-foreground">
								<IconSquareRoundedPlus class="size-3.5" /> <strong>เพิ่มลงหน้าจอโฮม</strong>
							</span>
						</p>
					{:else}
						<!-- Android/Desktop Prompt -->
						<p class="text-[13px] text-muted-foreground">
							ติดตั้งแอป Trackivity ลงในเครื่อง เพื่อให้เข้าใช้งานง่ายและรวดเร็วขึ้น
						</p>
						<Button
							onclick={installPWA}
							class="mt-3 w-full gap-2 rounded-full font-medium"
							size="sm"
						>
							ติดตั้งแอปพลิเคชัน
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
