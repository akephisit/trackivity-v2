<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import {
		calculateActivitySummaryWithProgress,
		getActivityTypeDisplayName,
		getActivityLevelColor,
		formatHoursDisplay,
		calculatePercentage,
		getProgressColor,
		type ActivitySummaryStats,
		type ActivityRequirements
	} from '$lib/utils/activity-summary';
	import {
		IconFileText,
		IconPrinter,
		IconDownload,
		IconSchool,
		IconBuilding,
		IconAward,
		IconTrendingUp,
		IconUser,
		IconHourglass,
		IconActivity,
		IconCircleCheck,
		IconChartBar,
		IconTarget,
		IconProgress,
		IconInfoCircle
	} from '@tabler/icons-svelte';

	let { data } = $props<{
		data: {
			participationHistory: any[];
			userInfo: {
				student_id: string;
				first_name: string;
				last_name: string;
				email: string;
			} | null;
			activityRequirements: ActivityRequirements | null;
		};
	}>();

	// Calculate summary statistics with progress information
	let stats: ActivitySummaryStats = $derived(
		calculateActivitySummaryWithProgress(
			data.participationHistory || [],
			data.activityRequirements || undefined
		)
	);

	// Generate report date
	const reportDate = new Date().toLocaleDateString('th-TH', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long'
	});

	function handlePrint() {
		window.print();
	}

	async function handleExport() {
		try {
			const response = await fetch('/student/summary/export');
			if (!response.ok) {
				throw new Error('ดาวน์โหลดไฟล์ไม่สำเร็จ');
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			const timestamp = new Date().toISOString().slice(0, 10);
			link.href = url;
			link.download = `student-activity-summary-${timestamp}.pdf`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export PDF failed:', error);
			alert('ไม่สามารถส่งออกไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง');
		}
	}

	// Get sorted activity types for consistent display
	function getSortedActivityTypes(byType: Record<string, { count: number; hours: number }>) {
		return Object.entries(byType)
			.sort(([, a], [, b]) => b.hours - a.hours) // Sort by hours desc
			.map(([type, data]) => ({ type, ...data }));
	}
</script>

<svelte:head>
	<title>สรุปกิจกรรม - Trackivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="container space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">สรุปผลการเข้าร่วมกิจกรรม</h1>
			<p class="text-muted-foreground">รายงานสรุปกิจกรรมที่เข้าร่วมแยกตามระดับคณะและมหาวิทยาลัย</p>
		</div>

		<!-- Action Buttons -->
		<div class="no-print flex gap-2">
			<Button variant="outline" onclick={handleExport} class="gap-2">
				<IconDownload class="size-4" />
				ส่งออก
			</Button>
		</div>
	</div>

	<!-- Report Header Card -->
	<Card class="print-break-after border-2">
		<CardHeader>
			<div class="flex items-center gap-3">
				<IconFileText class="size-6 text-primary" />
				<div>
					<CardTitle class="text-xl">รายงานสรุปผลการเข้าร่วมกิจกรรม</CardTitle>
					<p class="mt-1 text-sm text-muted-foreground">Academic Activity Summary Report</p>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Student Information -->
			{#if data.userInfo}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="flex items-center gap-3">
						<IconUser class="size-4 text-muted-foreground" />
						<div>
							<p class="text-sm font-medium">ชื่อ-นามสกุล</p>
							<p class="text-sm text-muted-foreground">
								{data.userInfo.first_name}
								{data.userInfo.last_name}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<IconActivity class="size-4 text-muted-foreground" />
						<div>
							<p class="text-sm font-medium">รหัสนักศึกษา</p>
							<p class="text-sm text-muted-foreground">{data.userInfo.student_id}</p>
						</div>
					</div>
					<!-- Removed academic year display per request -->
					<div class="flex items-center gap-3">
						<IconFileText class="size-4 text-muted-foreground" />
						<div>
							<p class="text-sm font-medium">วันที่รายงาน</p>
							<p class="text-sm text-muted-foreground">{reportDate}</p>
						</div>
					</div>
				</div>
			{/if}

			<Separator />

			<!-- Quick Stats -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-primary/10 p-2">
						<IconTrendingUp class="size-4 text-primary" />
					</div>
					<div>
						<p class="text-2xl font-bold">{stats.totalActivities}</p>
						<p class="text-xs text-muted-foreground">กิจกรรมทั้งหมด</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-green-100 p-2 dark:bg-green-900">
						<IconCircleCheck class="size-4 text-green-600 dark:text-green-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">{stats.completedActivities}</p>
						<p class="text-xs text-muted-foreground">เสร็จสิ้น</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
						<IconHourglass class="size-4 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">{stats.totalHours}</p>
						<p class="text-xs text-muted-foreground">ชั่วโมงรวม</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-900">
						<IconChartBar class="size-4 text-orange-600 dark:text-orange-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">{stats.completionRate}%</p>
						<p class="text-xs text-muted-foreground">อัตราเสร็จสิ้น</p>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Progress Section -->
	{#if data.activityRequirements && stats.progress}
		<Card class="border-2 border-primary/20">
			<CardHeader>
				<div class="flex items-center gap-3">
					<IconTarget class="size-6 text-primary" />
					<div>
						<CardTitle class="text-xl">ความก้าวหน้าในการเข้าร่วมกิจกรรม</CardTitle>
						<p class="text-sm text-muted-foreground">
							Progress Tracking Based on Faculty Requirements
						</p>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6">
				<!-- Overall Progress -->
				<div class="rounded-lg border bg-muted/30 p-4">
					<h4 class="mb-4 font-semibold">สถานะรวม</h4>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="rounded-full bg-primary/10 p-2">
									<IconProgress class="size-4 text-primary" />
								</div>
								<div>
									<p class="font-medium">ความก้าวหน้าโดยรวม</p>
									<p class="text-sm text-muted-foreground">
										{stats.progress.overallProgress.current} จาก {stats.progress.overallProgress
											.required} ชั่วโมง
									</p>
								</div>
							</div>
							<div class="text-right">
								<p
									class={`text-lg font-bold ${getProgressColor(stats.progress.overallProgress.percentage, stats.progress.overallProgress.isPassing).textClass}`}
								>
									{stats.progress.overallProgress.percentage}%
								</p>
								<p
									class={`text-xs ${stats.progress.overallProgress.isPassing ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
								>
									{#if stats.progress.overallProgress.isPassing}
										✅ ผ่านเกณฑ์
									{:else if stats.progress.overallProgress.remaining > 0}
										เหลืออีก {stats.progress.overallProgress.remaining} ชั่วโมง
									{/if}
								</p>
							</div>
						</div>
						<div class="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class={`h-3 rounded-full transition-all duration-500 ${getProgressColor(stats.progress.overallProgress.percentage, stats.progress.overallProgress.isPassing).bgClass}`}
								style="width: {Math.min(100, stats.progress.overallProgress.percentage)}%"
							></div>
						</div>
					</div>
				</div>

				<!-- Level-specific Progress -->
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Faculty Progress -->
					<div class="space-y-4">
						<h4 class="flex items-center gap-2 font-semibold">
							<IconSchool class="size-4 text-green-600" />
							ระดับคณะ
						</h4>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium">ชั่วโมงที่เข้าร่วม</p>
									<p class="text-xs text-muted-foreground">
										{stats.progress.facultyProgress.current} จาก {stats.progress.facultyProgress
											.required} ชั่วโมง
									</p>
								</div>
								<div class="text-right">
									<p
										class={`font-bold ${getProgressColor(stats.progress.facultyProgress.percentage, stats.progress.facultyProgress.isPassing).textClass}`}
									>
										{stats.progress.facultyProgress.percentage}%
									</p>
									<p
										class={`text-xs ${stats.progress.facultyProgress.isPassing ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
									>
										{#if stats.progress.facultyProgress.isPassing}
											✅ ผ่าน
										{:else}
											เหลือ {stats.progress.facultyProgress.remaining} ชั่วโมง
										{/if}
									</p>
								</div>
							</div>
							<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<div
									class={`h-2 rounded-full transition-all duration-500 ${getProgressColor(stats.progress.facultyProgress.percentage, stats.progress.facultyProgress.isPassing).bgClass}`}
									style="width: {Math.min(100, stats.progress.facultyProgress.percentage)}%"
								></div>
							</div>
						</div>
					</div>

					<!-- University Progress -->
					<div class="space-y-4">
						<h4 class="flex items-center gap-2 font-semibold">
							<IconBuilding class="size-4 text-blue-600" />
							ระดับมหาวิทยาลัย
						</h4>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium">ชั่วโมงที่เข้าร่วม</p>
									<p class="text-xs text-muted-foreground">
										{stats.progress.universityProgress.current} จาก {stats.progress
											.universityProgress.required} ชั่วโมง
									</p>
								</div>
								<div class="text-right">
									<p
										class={`font-bold ${getProgressColor(stats.progress.universityProgress.percentage, stats.progress.universityProgress.isPassing).textClass}`}
									>
										{stats.progress.universityProgress.percentage}%
									</p>
									<p
										class={`text-xs ${stats.progress.universityProgress.isPassing ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
									>
										{#if stats.progress.universityProgress.isPassing}
											✅ ผ่าน
										{:else}
											เหลือ {stats.progress.universityProgress.remaining} ชั่วโมง
										{/if}
									</p>
								</div>
							</div>
							<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<div
									class={`h-2 rounded-full transition-all duration-500 ${getProgressColor(stats.progress.universityProgress.percentage, stats.progress.universityProgress.isPassing).bgClass}`}
									style="width: {Math.min(100, stats.progress.universityProgress.percentage)}%"
								></div>
							</div>
						</div>
					</div>
				</div>

				<!-- Requirements Info -->
				<div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
					<div class="flex items-start gap-2 text-blue-700 dark:text-blue-300">
						<IconInfoCircle class="mt-0.5 size-4" />
						<div>
							<p class="text-sm font-medium">เกณฑ์การผ่านกิจกรรม</p>
							<div class="mt-2 text-xs text-blue-600 dark:text-blue-400">
								<p>
									• กิจกรรมระดับคณะ: อย่างน้อย {data.activityRequirements.requiredFacultyHours} ชั่วโมง
								</p>
								<p>
									• กิจกรรมระดับมหาวิทยาลัย: อย่างน้อย {data.activityRequirements
										.requiredUniversityHours} ชั่วโมง
								</p>
								<p class="mt-1 font-medium">
									รวม: {data.activityRequirements.requiredFacultyHours +
										data.activityRequirements.requiredUniversityHours} ชั่วโมง
								</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Activity Level Breakdown -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Faculty Level Activities -->
		<Card
			class={`border-2 ${getActivityLevelColor('faculty').borderClass} ${getActivityLevelColor('faculty').bgClass}`}
		>
			<CardHeader>
				<div class="flex items-center gap-3">
					<IconSchool class={`size-6 ${getActivityLevelColor('faculty').textClass}`} />
					<div>
						<CardTitle class="text-xl">กิจกรรมระดับคณะ</CardTitle>
						<p class="text-sm text-muted-foreground">Faculty Level Activities</p>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				<!-- Faculty Summary Stats -->
				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-lg bg-background/50 p-4 text-center">
						<p class="text-2xl font-bold">{stats.facultyLevel.activities}</p>
						<p class="text-sm text-muted-foreground">กิจกรรม</p>
					</div>
					<div class="rounded-lg bg-background/50 p-4 text-center">
						<p class="text-2xl font-bold">{stats.facultyLevel.hours}</p>
						<p class="text-sm text-muted-foreground">ชั่วโมง</p>
					</div>
				</div>

				<!-- Faculty Activity Types -->
				{#if Object.keys(stats.facultyLevel.byType).length > 0}
					<div class="space-y-3">
						<h4 class="font-medium">แยกตามประเภทกิจกรรม</h4>
						<div class="space-y-2">
							{#each getSortedActivityTypes(stats.facultyLevel.byType) as { type, count, hours }}
								<div class="flex items-center justify-between rounded-lg bg-background/50 p-3">
									<div class="flex items-center gap-2">
										<Badge variant="outline" class="text-xs">
											{getActivityTypeDisplayName(type)}
										</Badge>
										<span class="text-sm">{count} กิจกรรม</span>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">{formatHoursDisplay(hours)}</p>
										<p class="text-xs text-muted-foreground">
											{calculatePercentage(hours, stats.facultyLevel.hours)}% ของระดับคณะ
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="py-8 text-center text-muted-foreground">
						<IconSchool class="mx-auto mb-2 size-8 opacity-50" />
						<p>ยังไม่มีกิจกรรมระดับคณะที่เสร็จสิ้น</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- University Level Activities -->
		<Card
			class={`border-2 ${getActivityLevelColor('university').borderClass} ${getActivityLevelColor('university').bgClass}`}
		>
			<CardHeader>
				<div class="flex items-center gap-3">
					<IconBuilding class={`size-6 ${getActivityLevelColor('university').textClass}`} />
					<div>
						<CardTitle class="text-xl">กิจกรรมระดับมหาวิทยาลัย</CardTitle>
						<p class="text-sm text-muted-foreground">University Level Activities</p>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				<!-- University Summary Stats -->
				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-lg bg-background/50 p-4 text-center">
						<p class="text-2xl font-bold">{stats.universityLevel.activities}</p>
						<p class="text-sm text-muted-foreground">กิจกรรม</p>
					</div>
					<div class="rounded-lg bg-background/50 p-4 text-center">
						<p class="text-2xl font-bold">{stats.universityLevel.hours}</p>
						<p class="text-sm text-muted-foreground">ชั่วโมง</p>
					</div>
				</div>

				<!-- University Activity Types -->
				{#if Object.keys(stats.universityLevel.byType).length > 0}
					<div class="space-y-3">
						<h4 class="font-medium">แยกตามประเภทกิจกรรม</h4>
						<div class="space-y-2">
							{#each getSortedActivityTypes(stats.universityLevel.byType) as { type, count, hours }}
								<div class="flex items-center justify-between rounded-lg bg-background/50 p-3">
									<div class="flex items-center gap-2">
										<Badge variant="outline" class="text-xs">
											{getActivityTypeDisplayName(type)}
										</Badge>
										<span class="text-sm">{count} กิจกรรม</span>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">{formatHoursDisplay(hours)}</p>
										<p class="text-xs text-muted-foreground">
											{calculatePercentage(hours, stats.universityLevel.hours)}% ของระดับมหาวิทยาลัย
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="py-8 text-center text-muted-foreground">
						<IconBuilding class="mx-auto mb-2 size-8 opacity-50" />
						<p>ยังไม่มีกิจกรรมระดับมหาวิทยาลัยที่เสร็จสิ้น</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Overall Distribution Chart -->
	<Card class="border-2">
		<CardHeader>
			<div class="flex items-center gap-3">
				<IconAward class="size-6 text-primary" />
				<div>
					<CardTitle class="text-xl">สัดส่วนกิจกรรมทั้งหมด</CardTitle>
					<p class="text-sm text-muted-foreground">Overall Activity Distribution</p>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="grid gap-6 md:grid-cols-2">
				<!-- Hours Distribution -->
				<div class="space-y-4">
					<h4 class="font-medium">การกระจายชั่วโมง</h4>
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full bg-green-500"></div>
								<span class="text-sm">ระดับคณะ</span>
							</div>
							<div class="text-right">
								<p class="text-sm font-medium">{stats.facultyLevel.hours} ชั่วโมง</p>
								<p class="text-xs text-muted-foreground">
									{calculatePercentage(stats.facultyLevel.hours, stats.totalHours)}%
								</p>
							</div>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class="h-2 rounded-full bg-green-500"
								style="width: {calculatePercentage(stats.facultyLevel.hours, stats.totalHours)}%"
							></div>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full bg-blue-500"></div>
								<span class="text-sm">ระดับมหาวิทยาลัย</span>
							</div>
							<div class="text-right">
								<p class="text-sm font-medium">{stats.universityLevel.hours} ชั่วโมง</p>
								<p class="text-xs text-muted-foreground">
									{calculatePercentage(stats.universityLevel.hours, stats.totalHours)}%
								</p>
							</div>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class="h-2 rounded-full bg-blue-500"
								style="width: {calculatePercentage(stats.universityLevel.hours, stats.totalHours)}%"
							></div>
						</div>
					</div>
				</div>

				<!-- Activity Count Distribution -->
				<div class="space-y-4">
					<h4 class="font-medium">การกระจายจำนวนกิจกรรม</h4>
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full bg-green-500"></div>
								<span class="text-sm">ระดับคณะ</span>
							</div>
							<div class="text-right">
								<p class="text-sm font-medium">{stats.facultyLevel.activities} กิจกรรม</p>
								<p class="text-xs text-muted-foreground">
									{calculatePercentage(stats.facultyLevel.activities, stats.completedActivities)}%
								</p>
							</div>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class="h-2 rounded-full bg-green-500"
								style="width: {calculatePercentage(
									stats.facultyLevel.activities,
									stats.completedActivities
								)}%"
							></div>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full bg-blue-500"></div>
								<span class="text-sm">ระดับมหาวิทยาลัย</span>
							</div>
							<div class="text-right">
								<p class="text-sm font-medium">{stats.universityLevel.activities} กิจกรรม</p>
								<p class="text-xs text-muted-foreground">
									{calculatePercentage(
										stats.universityLevel.activities,
										stats.completedActivities
									)}%
								</p>
							</div>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<div
								class="h-2 rounded-full bg-blue-500"
								style="width: {calculatePercentage(
									stats.universityLevel.activities,
									stats.completedActivities
								)}%"
							></div>
						</div>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Footer for Official Reports -->
	<Card class="print-break-before border-dashed">
		<CardContent class="py-4 text-center text-sm text-muted-foreground">
			<p>รายงานนี้สร้างขึ้นโดยระบบ Trackivity - Activity Tracking System</p>
			<p>วันที่สร้างรายงาน: {reportDate}</p>
			<!-- Removed activity period range per request -->
		</CardContent>
	</Card>
</div>

<!-- Print styles -->
<style>
	@media print {
		:global(.no-print) {
			display: none !important;
		}

		:global(.print-break-before) {
			page-break-before: always;
		}

		:global(.print-break-after) {
			page-break-after: always;
		}

		:global(body) {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		:global(.container) {
			max-width: none !important;
			padding: 0 !important;
		}
	}
</style>
