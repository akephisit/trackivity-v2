<script lang="ts">
	import { page } from '$app/state';

	type Props = {
		title: string;
		description?: string;
		image?: string; // absolute or relative path
		imageWidth?: number;
		imageHeight?: number;
		imageAlt?: string;
		url?: string; // absolute URL; defaults to current
		type?: 'website' | 'article' | string;
		siteName?: string;
		locale?: string;
	};

	const {
		title,
		description = 'ระบบบันทึกกิจกรรมของมหาวิทยาลัย จัดการ ลงทะเบียน และติดตามกิจกรรมทั้งหมดได้ในที่เดียว',
		image = '/pwa-512x512.png',
		imageWidth = 512,
		imageHeight = 512,
		imageAlt = 'Trackivity',
		url,
		type = 'website',
		siteName = 'Trackivity',
		locale = 'th_TH'
	}: Props = $props();

	let canonical = $derived(url || page.url?.href || '');
	let ogImage = $derived.by(() => {
		const current = page.url;
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
		<meta property="og:image:width" content={String(imageWidth)} />
		<meta property="og:image:height" content={String(imageHeight)} />
		<meta property="og:image:alt" content={imageAlt} />
	{/if}

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	{#if ogImage}
		<meta name="twitter:image" content={ogImage} />
		<meta name="twitter:image:alt" content={imageAlt} />
	{/if}
</svelte:head>
