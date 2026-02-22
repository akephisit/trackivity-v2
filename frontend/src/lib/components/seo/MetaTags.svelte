<script lang="ts">
	import { page } from '$app/stores';

	type Props = {
		title: string;
		description?: string;
		image?: string; // absolute or relative path
		url?: string; // absolute URL; defaults to current
		type?: 'website' | 'article' | string;
		siteName?: string;
		locale?: string;
	};

	const {
		title,
		description = 'ระบบติดตามกิจกรรมของมหาวิทยาลัย จัดการ ลงทะเบียน และติดตามกิจกรรมทั้งหมดได้ในที่เดียว',
		image = '/favicon.svg',
		url,
		type = 'website',
		siteName = 'Trackivity',
		locale = 'th_TH'
	}: Props = $props();

	let canonical = $derived(url || $page.url?.href || '');
	let ogImage = $derived.by(() => {
		const current = $page.url;
		if (image?.startsWith('http')) {
			return image;
		} else if (current && image) {
			return `${current.origin}${image.startsWith('/') ? image : `/${image}`}`;
		}
		return image || '';
	});

	const fullTitle = $derived(`${title}${siteName ? ` - ${siteName}` : ''}`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="title" content={fullTitle} />
	{#if description}
		<meta name="description" content={description} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={type} />
	<meta property="og:title" content={fullTitle} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:site_name" content={siteName} />
	<meta property="og:locale" content={locale} />
	{#if canonical}
		<meta property="og:url" content={canonical} />
		<link rel="canonical" href={canonical} />
	{/if}
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
	{/if}

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	{#if ogImage}
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>
