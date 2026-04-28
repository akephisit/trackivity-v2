<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';

	import { onMount } from 'svelte';
	let { children } = $props();

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Trackivity',
		alternateName: 'ระบบบันทึกกิจกรรม',
		url: 'https://sci.utrackivity.com',
		applicationCategory: 'EducationalApplication',
		operatingSystem: 'Web',
		inLanguage: 'th-TH',
		description:
			'ระบบบันทึกกิจกรรมนักศึกษาของคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏเทพสตรี',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
		publisher: {
			'@type': 'Organization',
			name: 'สโมสรนักศึกษาคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏเทพสตรี',
			parentOrganization: {
				'@type': 'CollegeOrUniversity',
				name: 'มหาวิทยาลัยราชภัฏเทพสตรี',
				url: 'https://www.tru.ac.th'
			}
		}
	};

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
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
<InstallPrompt />

<!-- SSE removed for now -->

{@render children?.()}
