<script lang="ts">
	import StudentDashboard from '$lib/components/dashboard/StudentDashboard.svelte';
	import { currentUser } from '$lib/stores/auth';
	import type { Activity } from '$lib/types';
    import MetaTags from '$lib/components/seo/MetaTags.svelte';
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

<MetaTags title="แดชบอร์ดนักศึกษา" description="ติดตามกิจกรรมและผลงานของคุณ" />

<!-- Welcome Banner for Desktop and Mobile -->
<div class="mb-6 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 lg:p-6">
	<h2 class="admin-page-title mb-1">
		สวัสดี, {$currentUser?.first_name}!
	</h2>
	<p class="text-sm lg:text-base text-muted-foreground">ติดตามกิจกรรมและผลงานของคุณได้ที่นี่</p>
</div>

<StudentDashboard
	{...{
		recentActivities: data.recentActivities,
		participationHistory: data.participationHistory,
		stats: data.stats
	}}
/>
