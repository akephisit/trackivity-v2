<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import StudentDashboard from '$lib/components/dashboard/StudentDashboard.svelte';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { getDailyGreeting } from '$lib/utils/greeting';

	const user = $derived(authStore.user);
	const greeting = $derived(
		user
			? getDailyGreeting(user.first_name, 'student')
			: { greeting: 'สวัสดี!', subtitle: 'ติดตามกิจกรรมและผลงานของคุณได้ที่นี่' }
	);
</script>

<MetaTags title="แดชบอร์ดนักศึกษา" description="ติดตามกิจกรรมและผลงานของคุณ" />

<div
	class="mb-6 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 lg:p-6"
>
	<h2 class="admin-page-title mb-1">{greeting.greeting}</h2>
	<p class="text-sm text-muted-foreground lg:text-base">{greeting.subtitle}</p>
</div>

<StudentDashboard />
