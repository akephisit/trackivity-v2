<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { IconTrendingUp, IconHourglass, IconCircleCheck, IconActivity, IconUser } from '@tabler/icons-svelte';

	type ParticipationItem = {
		activity?: {
			title: string | null;
			hours: number | null;
			activity_level: string | null;
		} | null;
	};

	type SummaryData = {
		participationHistory: Array<{
			activity: ParticipationItem['activity'];
		}>;
		userInfo: {
			student_id: string;
			first_name: string;
			last_name: string;
			email: string;
			department_name?: string | null;
			organization_name?: string | null;
		} | null;
		activityRequirements: {
			requiredFacultyHours: number | null;
			requiredUniversityHours: number | null;
		} | null;
	};

	let { data } = $props<{ summary: SummaryData }>();

	const facultyActivities = $derived(
		(data.summary.participationHistory ?? []).filter(
			(item: ParticipationItem) => item.activity?.activity_level === 'faculty'
		)
	);
	const universityActivities = $derived(
		(data.summary.participationHistory ?? []).filter(
			(item: ParticipationItem) => item.activity?.activity_level === 'university'
		)
	);
	const sumHours = (items: Array<{ activity?: { hours: number | null } | null }>) =>
		items.reduce((total, item) => total + Number(item.activity?.hours ?? 0), 0);
	const totalHours = sumHours(data.summary.participationHistory ?? []);
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
			{#if data.summary.userInfo}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div class="flex items-center gap-2">
						<IconUser class="size-4 text-muted-foreground" />
						<div>
							<p class="text-xs text-muted-foreground">ชื่อ-นามสกุล</p>
							<p class="text-sm font-medium">
								{data.summary.userInfo.first_name} {data.summary.userInfo.last_name}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<IconActivity class="size-4 text-muted-foreground" />
						<div>
							<p class="text-xs text-muted-foreground">รหัสนักศึกษา</p>
							<p class="text-sm font-medium">{data.summary.userInfo.student_id}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<IconActivity class="size-4 text-muted-foreground" />
						<div>
							<p class="text-xs text-muted-foreground">คณะ / หน่วยงาน</p>
							<p class="text-sm font-medium">{data.summary.userInfo.organization_name ?? '-'}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<IconActivity class="size-4 text-muted-foreground" />
						<div>
							<p class="text-xs text-muted-foreground">ภาควิชา</p>
							<p class="text-sm font-medium">{data.summary.userInfo.department_name ?? '-'}</p>
						</div>
					</div>
				</div>
			{/if}

			<Separator />

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-lg bg-muted/40 p-4 text-center">
					<IconActivity class="mx-auto mb-2 size-5 text-primary" />
					<p class="text-2xl font-bold">{data.summary.participationHistory.length}</p>
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
