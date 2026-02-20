<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activities as activitiesApi, type Activity } from '$lib/api';
	import { onMount } from 'svelte';
	import StudentDashboard from '$lib/components/dashboard/StudentDashboard.svelte';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getDailyGreeting } from '$lib/utils/greeting';

	let recentActivities = $state<Activity[]>([]);
	let loading = $state(true);

	const user = $derived(authStore.user);
	const greeting = $derived(
		user
			? getDailyGreeting(user.first_name, 'student')
			: { greeting: 'สวัสดี!', subtitle: 'ติดตามกิจกรรมและผลงานของคุณได้ที่นี่' }
	);

	onMount(async () => {
		try {
			const dashboard = await activitiesApi.dashboard();
			recentActivities = dashboard.recent;
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	});
</script>

<MetaTags title="แดชบอร์ดนักศึกษา" description="ติดตามกิจกรรมและผลงานของคุณ" />

<div class="mb-6 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 lg:p-6">
	<h2 class="admin-page-title mb-1">{greeting.greeting}</h2>
	<p class="text-sm text-muted-foreground lg:text-base">{greeting.subtitle}</p>
</div>

{#if loading}
	<div class="flex h-40 items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else}
	<StudentDashboard
		recentActivities={recentActivities}
		participationHistory={[]}
		stats={{ totalParticipations: 0, thisMonthParticipations: 0, upcomingActivities: recentActivities.length }}
	/>
{/if}
