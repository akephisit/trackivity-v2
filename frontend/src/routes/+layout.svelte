<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';

	import { onMount } from 'svelte';
	let { children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch((err) => {
				console.error('[SW Registration Error]', err);
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Trackivity — ระบบบันทึกกิจกรรม</title>
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
<InstallPrompt />

<!-- SSE removed for now -->

{@render children?.()}
