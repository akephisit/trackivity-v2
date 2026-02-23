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
	<!-- Default SEO -->
	<title>Trackivity — ระบบติดตามกิจกรรม</title>
	<meta name="title" content="Trackivity — ระบบติดตามกิจกรรม" />
	<meta
		name="description"
		content="ระบบติดตามกิจกรรมของมหาวิทยาลัย จัดการ ลงทะเบียน และติดตามกิจกรรมทั้งหมดได้ในที่เดียว"
	/>
	<meta property="og:site_name" content="Trackivity" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="th_TH" />
	<!-- Note: Specific pages can override title/meta in their own <svelte:head> -->
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
<InstallPrompt />

<!-- SSE removed for now -->

{@render children?.()}
