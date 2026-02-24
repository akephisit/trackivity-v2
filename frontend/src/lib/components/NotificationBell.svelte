<script lang="ts">
	import { onMount } from 'svelte';
	import { IconBell } from '@tabler/icons-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { notificationsApi, type NotificationItem } from '$lib/api';
	import { env } from '$env/dynamic/public';
	import { browser } from '$app/environment';

	let notifications: NotificationItem[] = $state([]);
	let unreadCount = $derived(notifications.filter((n) => !n.read_at).length);
	let permissionStatus = $state<NotificationPermission | 'unknown'>('unknown');

	async function loadNotifications() {
		try {
			notifications = await notificationsApi.list();
		} catch (e) {
			console.error('Failed to load notifications', e);
		}
	}

	async function markAsRead(id: string) {
		try {
			await notificationsApi.markRead(id);
			notifications = notifications.map((n) =>
				n.id === id ? { ...n, read_at: new Date().toISOString() } : n
			);
		} catch (e) {
			console.error('Failed to mark read', e);
		}
	}

	async function markAllAsRead() {
		try {
			await notificationsApi.markAllRead();
			notifications = notifications.map((n) => ({ ...n, read_at: new Date().toISOString() }));
		} catch (e) {
			console.error('Failed to mark all read', e);
		}
	}

	async function subscribeToPush(interactive = false) {
		if (!browser || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

		const vapidPublicKey = env.PUBLIC_VAPID_KEY;
		if (!vapidPublicKey) return;

		try {
			// Always explicitly register the service worker for production builds
			const registration = await navigator.serviceWorker.register('/service-worker.js');
			await navigator.serviceWorker.ready;

			let subscription = await registration.pushManager.getSubscription();

			// Only ask for permission if we don't have a subscription yet
			if (!subscription && Notification.permission !== 'granted') {
				// If not interactive (auto-poll), we don't prompt on iOS automatically
				// since iOS requires a direct user interaction.
				if (!interactive && Notification.permission === 'default') {
					permissionStatus = 'default';
					return;
				}

				const permission = await Notification.requestPermission();
				permissionStatus = permission;
				if (permission !== 'granted') return;
			} else {
				permissionStatus = Notification.permission;
			}

			if (!subscription) {
				const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
				const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
				const rawData = window.atob(base64);
				const outputArray = new Uint8Array(rawData.length);
				for (let i = 0; i < rawData.length; ++i) {
					outputArray[i] = rawData.charCodeAt(i);
				}

				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: outputArray
				});
			}

			// Must be URL-safe base64 for the Rust web-push crate
			function arrayBufferToUrlSafeBase64(buffer: ArrayBuffer): string {
				let binary = '';
				const bytes = new Uint8Array(buffer);
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
			}

			const p256dh = arrayBufferToUrlSafeBase64(subscription.getKey('p256dh')!);
			const auth = arrayBufferToUrlSafeBase64(subscription.getKey('auth')!);

			await notificationsApi.subscribe(subscription.endpoint, { p256dh, auth });
		} catch (e) {
			console.error('Push subscription failed:', e);
		}
	}

	onMount(() => {
		if (browser && 'Notification' in window) {
			permissionStatus = Notification.permission;
		}

		loadNotifications();

		// Attempt silent/auto-subscribe in background - won't prompt if interactive=false
		// and won't interrupt iOS.
		setTimeout(() => subscribeToPush(false), 2000);

		// Polling for MVP (Real-time SSE is better but this works for now)
		const interval = setInterval(loadNotifications, 30000);
		return () => clearInterval(interval);
	});

	function formatTime(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="sm" class="relative p-2">
				<IconBell class="size-4" />
				{#if unreadCount > 0}
					<span
						class="text-destructive-foreground absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold"
					>
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content align="end" class="w-80">
		<DropdownMenu.Label class="flex items-center justify-between">
			<span>การแจ้งเตือน</span>
			{#if unreadCount > 0}
				<button class="text-xs text-primary hover:underline" onclick={markAllAsRead}>
					อ่านทั้งหมด
				</button>
			{/if}
		</DropdownMenu.Label>
		<DropdownMenu.Separator />

		{#if permissionStatus === 'default' || permissionStatus === 'denied'}
			<div class="m-2 rounded bg-muted/50 p-3 text-xs">
				<div class="mb-1 font-semibold text-orange-500">
					{#if permissionStatus === 'default'}
						⚠️ ยังไม่ได้เปิดการแจ้งเตือน
					{:else}
						❌ การแจ้งเตือนถูกปิดกั้น
					{/if}
				</div>
				<span class="text-muted-foreground">เพื่อให้คุณไม่พลาดกิจกรรมและการเช็คอิน กรุณาอนุญาต</span
				>
				{#if permissionStatus === 'default'}
					<Button
						onclick={() => subscribeToPush(true)}
						variant="outline"
						size="sm"
						class="mt-2 h-7 w-full text-xs"
					>
						เปิดการแจ้งเตือน
					</Button>
				{/if}
			</div>
			<DropdownMenu.Separator />
		{/if}

		<div class="max-h-[60vh] overflow-y-auto">
			{#if notifications.length === 0}
				<div class="p-4 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</div>
			{:else}
				{#each notifications as notification}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="relative flex cursor-pointer flex-col gap-1 border-b p-3 transition-colors last:border-0 hover:bg-muted {notification.read_at
							? 'opacity-70'
							: ''}"
						onclick={() => {
							if (!notification.read_at) markAsRead(notification.id);
							if (notification.link && browser) window.location.href = notification.link;
						}}
					>
						{#if !notification.read_at}
							<div class="absolute top-4 left-2 h-2 w-2 rounded-full bg-primary"></div>
						{/if}
						<div class="flex items-start justify-between pl-4">
							<h4 class="text-sm font-semibold">{notification.title}</h4>
							<span class="ml-2 text-xs whitespace-nowrap text-muted-foreground"
								>{formatTime(notification.created_at)}</span
							>
						</div>
						<p class="line-clamp-2 pl-4 text-xs text-muted-foreground">{notification.message}</p>
					</div>
				{/each}
			{/if}
		</div>
	</DropdownMenu.Content>
</DropdownMenu.Root>
