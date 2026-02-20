<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { IconTrendingUp, IconHourglass, IconCircleCheck, IconActivity, IconUser } from '@tabler/icons-svelte';
	import { activitiesApi, usersApi, ApiError } from '$lib/api';
	import type { Participation } from '$lib/api';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	const userId = $derived($page.params.userId);

	let loading = $state(true);
	let error = $state<string | null>(null);
	let participations = $state<Participation[]>([]);
	let userInfo = $state<{ student_id: string; first_name: string; last_name: string; email: string; department_name?: string | null; organization_name?: string | null } | null>(null);

	onMount(async () => {
		try {
			const data = await activitiesApi.myParticipations();
			participations = data;
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลได้';
		} finally {
			loading = false;
		}
	});

	const facultyActivities = $derived(
		participations.filter((p) => p.activity?.activity_level === 'faculty')
	);
	const universityActivities = $derived(
		participations.filter((p) => p.activity?.activity_level === 'university')
	);
	const sumHours = (items: Participation[]) =>
		items.reduce((total, p) => total + Number(p.activity?.hours ?? 0), 0);
	const totalHours = $derived(sumHours(participations));
</script>

<svelte:head>
	<title>ตรวจสอบรายงานกิจกรรม - Trackivity</title>
</svelte:head>

<div class="container py-8 space-y-6">
	<Card>
		<CardHeader>
			<CardTitle>รายงานสรุปผลการเข้าร่วมกิจกรรม</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if loading}
				<Skeleton class="h-24 w-full" />
			{:else if error}
				<p class="text-destructive">{error}</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-lg bg-muted/40 p-4 text-center">
						<IconActivity class="mx-auto mb-2 size-5 text-primary" />
						<p class="text-2xl font-bold">{participations.length}</p>
						<p class="text-xs text-muted-foreground">จำนวนกิจกรรมทั้งหมด</p>
					</div>
					<div class="rounded-lg bg-muted/40 p-4 text-center">
						<IconHourglass class="mx-auto mb-2 size-5 text-primary" />
						<p class="text-2xl font-bold">{totalHours.toFixed(2)}</p>
						<p class="text-xs text-muted-foreground">ชั่วโมงรวม</p>
					</div>
					<div class="rounded-lg bg-muted/40 p-4 text-center">
						<IconCircleCheck class="mx-auto mb-2 size-5 text-primary" />
						<p class="text-2xl font-bold">{facultyActivities.length}</p>
						<p class="text-xs text-muted-foreground">กิจกรรมระดับคณะ</p>
					</div>
					<div class="rounded-lg bg-muted/40 p-4 text-center">
						<IconTrendingUp class="mx-auto mb-2 size-5 text-primary" />
						<p class="text-2xl font-bold">{universityActivities.length}</p>
						<p class="text-xs text-muted-foreground">กิจกรรมระดับมหาวิทยาลัย</p>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<Card class="border-2">
		<CardHeader>
			<CardTitle class="text-lg">กิจกรรมระดับคณะ</CardTitle>
		</CardHeader>
		<CardContent>
			{#if facultyActivities.length}
				<div class="overflow-x-auto">
					<table class="w-full table-auto border-collapse text-sm">
						<thead class="bg-muted text-xs uppercase tracking-wide">
							<tr>
								<th class="border px-3 py-2 text-left">ลำดับ</th>
								<th class="border px-3 py-2 text-left">ชื่อกิจกรรม</th>
								<th class="border px-3 py-2 text-right w-32">ชั่วโมง</th>
							</tr>
						</thead>
						<tbody>
							{#each facultyActivities as activity, index}
								<tr class="odd:bg-background even:bg-muted/30">
									<td class="border px-3 py-2">{index + 1}</td>
									<td class="border px-3 py-2">{activity.activity?.title ?? '-'}</td>
									<td class="border px-3 py-2 text-right">
										{Number(activity.activity?.hours ?? 0).toFixed(2)}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-muted font-semibold">
							<tr>
								<td class="border px-3 py-2 text-left" colspan="2">รวม</td>
								<td class="border px-3 py-2 text-right">
									{sumHours(facultyActivities).toFixed(2)} ชั่วโมง
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรมระดับคณะ</p>
			{/if}
		</CardContent>
	</Card>

	<Card class="border-2">
		<CardHeader>
			<CardTitle class="text-lg">กิจกรรมระดับมหาวิทยาลัย</CardTitle>
		</CardHeader>
		<CardContent>
			{#if universityActivities.length}
				<div class="overflow-x-auto">
					<table class="w-full table-auto border-collapse text-sm">
						<thead class="bg-muted text-xs uppercase tracking-wide">
							<tr>
								<th class="border px-3 py-2 text-left">ลำดับ</th>
								<th class="border px-3 py-2 text-left">ชื่อกิจกรรม</th>
								<th class="border px-3 py-2 text-right w-32">ชั่วโมง</th>
							</tr>
						</thead>
						<tbody>
							{#each universityActivities as activity, index}
								<tr class="odd:bg-background even:bg-muted/30">
									<td class="border px-3 py-2">{index + 1}</td>
									<td class="border px-3 py-2">{activity.activity?.title ?? '-'}</td>
									<td class="border px-3 py-2 text-right">
										{Number(activity.activity?.hours ?? 0).toFixed(2)}
									</td>
							</tr>
						{/each}
					</tbody>
					<tfoot class="bg-muted font-semibold">
						<tr>
							<td class="border px-3 py-2 text-left" colspan="2">รวม</td>
							<td class="border px-3 py-2 text-right">
								{sumHours(universityActivities).toFixed(2)} ชั่วโมง
							</td>
						</tr>
					</tfoot>
					</table>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรมระดับมหาวิทยาลัย</p>
			{/if}
		</CardContent>
	</Card>
</div>
