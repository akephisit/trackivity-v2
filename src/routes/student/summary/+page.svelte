<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		calculateActivitySummary, 
		getActivityTypeDisplayName, 
		getActivityLevelColor,
		formatHoursDisplay,
		calculatePercentage,
		type ActivitySummaryStats
	} from '$lib/utils/activity-summary';
	import {
		IconFileText,
		IconPrinter,
		IconDownload,
		IconSchool,
		IconBuilding,
		IconAward,
		IconTrendingUp,
		IconCalendar,
		IconUser,
		IconHourglass,
		IconActivity,
		IconCircleCheck,
		IconChartBar
	} from '@tabler/icons-svelte';

	let { data } = $props<{ 
		data: { 
			participationHistory: any[]; 
			userInfo: {
				student_id: string;
				first_name: string;
				last_name: string;
				email: string;
			} | null
		} 
	}>();

	// Calculate summary statistics
	let stats: ActivitySummaryStats = $derived(
		calculateActivitySummary(data.participationHistory || [])
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

	function handleExport() {
		// Future enhancement: Generate PDF
		// For now, open print dialog which can save as PDF
		window.print();
	}

	// Get sorted activity types for consistent display
	function getSortedActivityTypes(byType: Record<string, { count: number; hours: number }>) {
		return Object.entries(byType)
			.sort(([, a], [, b]) => b.hours - a.hours) // Sort by hours desc
			.map(([type, data]) => ({ type, ...data }));
	}
</script>

<svelte:head>
	<title>สรุปกิจกรรม - Trackivity Student</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

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

<div class="container space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">สรุปผลการเข้าร่วมกิจกรรม</h1>
			<p class="text-muted-foreground">รายงานสรุปกิจกรรมที่เข้าร่วมแยกตามระดับคณะและมหาวิทยาลัย</p>
		</div>
		
		<!-- Action Buttons -->
		<div class="flex gap-2 no-print">
			<Button variant="outline" onclick={handlePrint} class="gap-2">
				<IconPrinter class="size-4" />
				พิมพ์
			</Button>
			<Button variant="outline" onclick={handleExport} class="gap-2">
				<IconDownload class="size-4" />
				ส่งออก
			</Button>
		</div>
	</div>

	<!-- Report Header Card -->
	<Card class="border-2 print-break-after">
		<CardHeader class="bg-muted/30">
			<div class="flex items-center gap-3">
				<IconFileText class="size-6 text-primary" />
				<div>
					<CardTitle class="text-xl">รายงานสรุปผลการเข้าร่วมกิจกรรม</CardTitle>
					<p class="text-sm text-muted-foreground mt-1">Academic Activity Summary Report</p>
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
								{data.userInfo.first_name} {data.userInfo.last_name}
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
					<div class="flex items-center gap-3">
						<IconCalendar class="size-4 text-muted-foreground" />
						<div>
							<p class="text-sm font-medium">ปีการศึกษา</p>
							<p class="text-sm text-muted-foreground">{stats.periodInfo.academicYear}</p>
						</div>
					</div>
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

	<!-- Activity Level Breakdown -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Faculty Level Activities -->
		<Card class={`border-2 ${getActivityLevelColor('faculty').borderClass} ${getActivityLevelColor('faculty').bgClass}`}>
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
					<div class="text-center p-4 rounded-lg bg-background/50">
						<p class="text-2xl font-bold">{stats.facultyLevel.activities}</p>
						<p class="text-sm text-muted-foreground">กิจกรรม</p>
					</div>
					<div class="text-center p-4 rounded-lg bg-background/50">
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
								<div class="flex items-center justify-between p-3 rounded-lg bg-background/50">
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
					<div class="text-center py-8 text-muted-foreground">
						<IconSchool class="size-8 mx-auto mb-2 opacity-50" />
						<p>ยังไม่มีกิจกรรมระดับคณะที่เสร็จสิ้น</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- University Level Activities -->
		<Card class={`border-2 ${getActivityLevelColor('university').borderClass} ${getActivityLevelColor('university').bgClass}`}>
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
					<div class="text-center p-4 rounded-lg bg-background/50">
						<p class="text-2xl font-bold">{stats.universityLevel.activities}</p>
						<p class="text-sm text-muted-foreground">กิจกรรม</p>
					</div>
					<div class="text-center p-4 rounded-lg bg-background/50">
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
								<div class="flex items-center justify-between p-3 rounded-lg bg-background/50">
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
					<div class="text-center py-8 text-muted-foreground">
						<IconBuilding class="size-8 mx-auto mb-2 opacity-50" />
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
						<div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
							<div 
								class="bg-green-500 h-2 rounded-full" 
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
						<div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
							<div 
								class="bg-blue-500 h-2 rounded-full" 
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
						<div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
							<div 
								class="bg-green-500 h-2 rounded-full" 
								style="width: {calculatePercentage(stats.facultyLevel.activities, stats.completedActivities)}%"
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
									{calculatePercentage(stats.universityLevel.activities, stats.completedActivities)}%
								</p>
							</div>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
							<div 
								class="bg-blue-500 h-2 rounded-full" 
								style="width: {calculatePercentage(stats.universityLevel.activities, stats.completedActivities)}%"
							></div>
						</div>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Footer for Official Reports -->
	<Card class="border-dashed print-break-before">
		<CardContent class="py-4 text-center text-sm text-muted-foreground">
			<p>รายงานนี้สร้างขึ้นโดยระบบ Trackivity - Activity Tracking System</p>
			<p>วันที่สร้างรายงาน: {reportDate}</p>
			{#if stats.periodInfo.startDate && stats.periodInfo.endDate}
				<p class="mt-1">
					ช่วงเวลากิจกรรม: {new Date(stats.periodInfo.startDate).toLocaleDateString('th-TH')} - 
					{new Date(stats.periodInfo.endDate).toLocaleDateString('th-TH')}
				</p>
			{/if}
		</CardContent>
	</Card>
</div>