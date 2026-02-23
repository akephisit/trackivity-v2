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

	async function subscribeToPush() {
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
				// We don't block render but iOS might require a button click to grant this.
				// In a real app we might put this behind a "Enable Notifications" button.
				const permission = await Notification.requestPermission();
				if (permission !== 'granted') return;
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
		loadNotifications();
		// Prompt for push implicitly after 3 seconds so we don't block render
		setTimeout(subscribeToPush, 3000);

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
				<IconBell class="size-5" />
				{#if unreadCount > 0}
					<span
						class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
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
