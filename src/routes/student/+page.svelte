<script lang="ts">
	import StudentDashboard from '$lib/components/dashboard/StudentDashboard.svelte';
	import { currentUser } from '$lib/stores/auth';
	import type { Activity } from '$lib/types';
	const { data } = $props<{
		recentActivities: Activity[];
		participationHistory: any[];
		stats: {
			totalParticipations: number;
			thisMonthParticipations: number;
			upcomingActivities: number;
		};
	}>();
</script>

<svelte:head>
	<title>Dashboard - Trackivity Student</title>
	<meta name="description" content="Student dashboard for activity tracking" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<!-- Welcome Banner for Mobile -->
<div class="mb-6 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 p-4 lg:hidden">
	<h2 class="mb-1 text-lg font-semibold">
		ยินดีต้อนรับ, {$currentUser?.first_name}!
	</h2>
	<p class="text-sm text-muted-foreground">ติดตามกิจกรรมและผลงานของคุณได้ที่นี่</p>
</div>

<StudentDashboard
	{...{
		recentActivities: data.recentActivities,
		participationHistory: data.participationHistory,
		stats: data.stats
	}}
/>
