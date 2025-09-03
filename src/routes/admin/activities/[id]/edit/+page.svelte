<script lang="ts">
	import type { Activity, ActivityStatus } from '$lib/types/activity';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Switch } from '$lib/components/ui/switch';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconAlertCircle,
		IconInfoCircle,
		IconEye,
		IconCalendar,
		IconClock
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import {
		type DateValue,
		getLocalTimeZone,
		today,
		parseDate
	} from '@internationalized/date';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import { formatThaiDate, formatThaiMonth, toBuddhistEra } from '$lib/utils/thai-date';

	const { data, form } = $props<{
		data: {
			activity: Activity;
			faculties: any[];
			user: any;
		};
		form?: { error?: string; formData?: any };
	}>();

	const { activity, faculties } = data;
	// user is available in data but not currently used

	let submitting = $state(false);
	let selectedStatus = $state(activity.status);
	// No department selection in edit page per requirement

	// Registration open toggle
	let registrationOpen = $state(!!activity.registration_open);

	// Eligible faculties selection (multi-select)
	// Build options from provided faculties list (server now supplies it)
	const facultyOptions = (Array.isArray(faculties) ? faculties : []).map((f: any) => ({
		value: f.id,
		label: f.name
	}));

	// Organizer selection state
	let selectedOrganizerId = $state((form as any)?.formData?.organizer_id || activity.organizer_id || '');
	const isSuperAdmin = (data?.user?.admin_role?.admin_level === 'SuperAdmin');

	// Import activity level options from utils
	import { activityLevelOptions } from '$lib/utils/activity';

	// Activity level selection state - convert display value to storage value
	let selectedActivityLevel = $state((form as any)?.formData?.activity_level || activity.activity_level || 'faculty');

	// Thai date formatting functions for calendar
	function formatCalendarMonth(monthNumber: number): string {
		const monthIndex = monthNumber - 1; // Convert to 0-based index
		return formatThaiMonth(monthIndex, 'long');
	}
	
	function formatCalendarYear(year: number): string {
		return toBuddhistEra(year).toString();
	}

	// Date picker values
	let startDateValue = $state<DateValue | undefined>(undefined);
	let endDateValue = $state<DateValue | undefined>(undefined);

	// Time picker values
	let startTimeHour = $state<string>('');
	let startTimeMinute = $state<string>('');
	let endTimeHour = $state<string>('');
	let endTimeMinute = $state<string>('');

	// Generate hour options (00-23)
	function generateHourOptions() {
		return Array.from({ length: 24 }, (_, i) => {
			const hour = i.toString().padStart(2, '0');
			return { value: hour, label: hour };
		});
	}

	// Generate minute options (00, 05, 10, 15, etc.)
	function generateMinuteOptions() {
		return Array.from({ length: 12 }, (_, i) => {
			const minute = (i * 5).toString().padStart(2, '0');
			return { value: minute, label: minute };
		});
	}

	const hourOptions = generateHourOptions();
	const minuteOptions = generateMinuteOptions();

	// Initial selected values from server - use array of strings (faculty IDs)
	let selectedEligibleValues = $state<string[]>(data.eligible_organizations_selected || []);
	// Derive faculty objects for display purposes
	let selectedEligible = $derived(
		selectedEligibleValues.map((id: string) => {
			const opt = facultyOptions.find((o) => o.value === id);
			return { value: id, label: opt?.label || id };
		})
	);

	// Extract date and time components from ISO string or separate database fields
	function extractDateFromActivity(activity: any): string {
		// Try to use separate date field first (more reliable)
		if (activity.start_date) {
			return activity.start_date;
		}
		// Fallback to parsing ISO string if needed
		if (activity.start_time) {
			return new Date(activity.start_time).toISOString().split('T')[0];
		}
		return '';
	}

	function extractTimeFromActivity(activity: any, isStart: boolean = true): string {
		const timeField = isStart ? 'start_time_only' : 'end_time_only';
		
		// Use the dedicated time field from database (PostgreSQL time type)
		if (activity[timeField]) {
			// The database time field is already in HH:MM:SS format
			// We need to extract just HH:MM for the HTML time input
			const timeStr = activity[timeField].toString();
			// Handle both HH:MM:SS and HH:MM formats
			if (timeStr.includes(':')) {
				const parts = timeStr.split(':');
				if (parts.length >= 2) {
					return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
				}
			}
		}
		
		return '';
	}

	function goBack() {
		goto(`/admin/activities/${activity.id}`);
	}

	function goToList() {
		goto('/admin/activities');
	}

	function previewActivity() {
		goto(`/admin/activities/${activity.id}`);
	}

	const statusOptions: { value: ActivityStatus; label: string; description: string }[] = [
		{
			value: 'draft',
			label: 'ร่าง',
			description: 'กิจกรรมยังไม่เผยแพร่ มองเห็นได้เฉพาะผู้จัดการ'
		},
		{
			value: 'published',
			label: 'เผยแพร่แล้ว',
			description: 'กิจกรรมเผยแพร่แล้ว ผู้ใช้สามารถลงทะเบียนได้'
		},
		{
			value: 'ongoing',
			label: 'กำลังดำเนินการ',
			description: 'กิจกรรมกำลังดำเนินการอยู่'
		},
		{
			value: 'completed',
			label: 'เสร็จสิ้น',
			description: 'กิจกรรมสิ้นสุดแล้ว'
		},
		{
			value: 'cancelled',
			label: 'ยกเลิก',
			description: 'กิจกรรมถูกยกเลิก'
		}
	];

	// Get current participants count for validation
	let currentParticipants = $derived(activity.current_participants || 0);

	// Initialize date picker values from activity data
	$effect(() => {
		// Initialize start date
		if (!startDateValue) {
			const dateStr = (form as any)?.formData?.start_date || extractDateFromActivity(activity);
			if (dateStr) {
				try {
					startDateValue = parseDate(dateStr);
				} catch (e) {
					// Invalid date format, ignore
				}
			}
		}

		// Initialize end date
		if (!endDateValue) {
			const dateStr = (form as any)?.formData?.end_date || (activity.end_date || extractDateFromActivity(activity));
			if (dateStr) {
				try {
					endDateValue = parseDate(dateStr);
				} catch (e) {
					// Invalid date format, ignore
				}
			}
		}

		// Initialize start time
		if (!startTimeHour) {
			const timeStr = (form as any)?.formData?.start_time || extractTimeFromActivity(activity, true);
			if (timeStr) {
				const [hour, minute] = timeStr.split(':');
				startTimeHour = hour || '';
				startTimeMinute = minute || '';
			}
		}

		// Initialize end time
		if (!endTimeHour) {
			const timeStr = (form as any)?.formData?.end_time || extractTimeFromActivity(activity, false);
			if (timeStr) {
				const [hour, minute] = timeStr.split(':');
				endTimeHour = hour || '';
				endTimeMinute = minute || '';
			}
		}
	});
</script>

<svelte:head>
	<title>แก้ไข{activity.title} - Admin Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" onclick={goBack}>
			<IconArrowLeft class="mr-2 size-4" />
			กลับ
		</Button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold lg:text-3xl">แก้ไขกิจกรรม</h1>
			<p class="text-muted-foreground">{activity.title} - Admin Panel</p>
		</div>
		<Button variant="outline" size="sm" onclick={previewActivity}>
			<IconEye class="mr-2 size-4" />
			ดูตัวอย่าง
		</Button>
	</div>

	<!-- Error Alert -->
	{#if form?.error}
		<Alert variant="destructive">
			<IconAlertCircle class="size-4" />
			<AlertDescription>{form.error}</AlertDescription>
		</Alert>
	{/if}

	<!-- Participants Warning -->
	{#if currentParticipants > 0}
		<Alert>
			<IconInfoCircle class="size-4" />
			<AlertDescription>
				กิจกรรมนี้มีผู้เข้าร่วมแล้ว {currentParticipants} คน การแก้ไขข้อมูลบางส่วนอาจส่งผลกระทบต่อผู้ที่ลงทะเบียนไว้
			</AlertDescription>
		</Alert>
	{/if}

	<!-- Edit Form -->
	<Card>
		<CardHeader>
			<CardTitle>รายละเอียดกิจกรรม</CardTitle>
		</CardHeader>

		<CardContent>
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						submitting = false;
						// Show success toast and redirect to detail page
						if (result?.type === 'redirect') {
							toast.success('แก้ไขกิจกรรมสำเร็จ');
							setTimeout(() => goto(`/admin/activities/${activity.id}`), 50);
							return;
						}

						if (result?.type === 'success') {
							// If server returned an object instead of redirect
							const data: any = (result as any).data;
							if (data?.error) {
								// Let form error render and also show toast
								toast.error(data.error);
								await update();
							} else {
								toast.success(data?.message || 'แก้ไขกิจกรรมสำเร็จ');
								setTimeout(() => goto(`/admin/activities/${activity.id}`), 50);
							}
							return;
						}

						// For other results (e.g., error), just update to reflect errors
						await update();
					};
				}}
				class="space-y-6"
			>
				<input type="hidden" name="status" value={selectedStatus} />
				<!-- Title -->
				<div class="space-y-2">
					<Label for="title">ชื่อกิจกรรม *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						placeholder="ชื่อกิจกรรม"
						value={form?.formData?.title || activity.title}
						class="text-base"
					/>
				</div>

				<!-- Description -->
				<div class="space-y-2">
					<Label for="description">คำอธิบาย</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="คำอธิบายเกี่ยวกับกิจกรรม"
						value={form?.formData?.description || activity.description}
						rows={4}
						class="resize-none"
					/>
				</div>

				<!-- Location -->
				<div class="space-y-2">
					<Label for="location">สถานที่ *</Label>
					<Input
						id="location"
						name="location"
						type="text"
						required
						placeholder="สถานที่จัดกิจกรรม"
						value={form?.formData?.location || activity.location}
						class="text-base"
					/>
				</div>

				<!-- Organizer (หน่วยงานผู้จัด) -->
				<div class="space-y-2">
					<Label for="organizer_id">หน่วยงานผู้จัด *</Label>
					<input type="hidden" name="organizer_id" bind:value={selectedOrganizerId} />
					<Select.Root
						type="single"
						bind:value={selectedOrganizerId as any}
						disabled={!isSuperAdmin}
					>
						<Select.Trigger>
							{#if selectedOrganizerId}
								{(facultyOptions.find((o) => o.value === selectedOrganizerId) || {}).label || 'เลือกหน่วยงานผู้จัด'}
							{:else}
								เลือกหน่วยงานผู้จัด
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each facultyOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Activity Level (ระดับกิจกรรม) -->
				<div class="space-y-2">
					<Label for="activity_level">ระดับกิจกรรม *</Label>
					<input type="hidden" name="activity_level" bind:value={selectedActivityLevel} />
					<Select.Root
						type="single"
						bind:value={selectedActivityLevel as any}
						disabled={submitting}
					>
						<Select.Trigger>
							{activityLevelOptions.find((opt) => opt.value === selectedActivityLevel)?.label ||
								'เลือกระดับกิจกรรม'}
						</Select.Trigger>
						<Select.Content>
							{#each activityLevelOptions as option}
								<Select.Item value={option.value}>
									<div class="flex flex-col">
										<span class="font-medium">{option.label}</span>
										<span class="text-sm text-gray-500">{option.description}</span>
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Date and Time -->
				<div class="space-y-4">
					<h3 class="flex items-center gap-2 text-lg font-semibold">
						<IconCalendar class="h-5 w-5 text-blue-600" />
						วันที่และเวลา
					</h3>
					
					<div class="grid gap-4 md:grid-cols-2">
						<!-- Start Date -->
						<div class="space-y-2">
							<Label class="text-base font-medium">วันที่เริ่ม *</Label>
							<input
								type="hidden"
								name="start_date"
								value={startDateValue ? startDateValue.toString() : (form?.formData?.start_date || extractDateFromActivity(activity))}
							/>
							<Popover.Root>
								<Popover.Trigger
									class={cn(
										buttonVariants({
											variant: "outline",
											class: "w-full justify-start text-left font-normal text-base"
										}),
										!startDateValue && "text-muted-foreground"
									)}
									disabled={submitting}
								>
									<IconCalendar class="mr-2 h-4 w-4" />
									{startDateValue ? formatThaiDate(startDateValue) : "เลือกวันที่เริ่ม"}
								</Popover.Trigger>
								<Popover.Content class="w-auto p-0">
									<Calendar
										type="single"
										bind:value={startDateValue}
										minValue={today(getLocalTimeZone())}
										disabled={submitting}
										locale="th-TH"
										captionLayout="dropdown"
										monthFormat={formatCalendarMonth}
										yearFormat={formatCalendarYear}
									/>
								</Popover.Content>
							</Popover.Root>
						</div>

						<!-- End Date -->
						<div class="space-y-2">
							<Label class="text-base font-medium">วันที่สิ้นสุด *</Label>
							<input
								type="hidden"
								name="end_date"
								value={endDateValue ? endDateValue.toString() : (form?.formData?.end_date || (activity.end_date || extractDateFromActivity(activity)))}
							/>
							<Popover.Root>
								<Popover.Trigger
									class={cn(
										buttonVariants({
											variant: "outline",
											class: "w-full justify-start text-left font-normal text-base"
										}),
										!endDateValue && "text-muted-foreground"
									)}
									disabled={submitting}
								>
									<IconCalendar class="mr-2 h-4 w-4" />
									{endDateValue ? formatThaiDate(endDateValue) : "เลือกวันที่สิ้นสุด"}
								</Popover.Trigger>
								<Popover.Content class="w-auto p-0">
									<Calendar
										type="single"
										bind:value={endDateValue}
										minValue={startDateValue || today(getLocalTimeZone())}
										disabled={submitting}
										locale="th-TH"
										captionLayout="dropdown"
										monthFormat={formatCalendarMonth}
										yearFormat={formatCalendarYear}
									/>
								</Popover.Content>
							</Popover.Root>
						</div>

						<!-- Start Time -->
						<div class="space-y-2">
							<Label class="flex items-center gap-2 text-base font-medium">
								<IconClock class="h-4 w-4" />
								เวลาเริ่ม *
							</Label>
							<input
								type="hidden"
								name="start_time"
								value={startTimeHour && startTimeMinute ? `${startTimeHour}:${startTimeMinute}` : (form?.formData?.start_time || extractTimeFromActivity(activity, true))}
							/>
							<div class="flex gap-2">
								<Select.Root
									type="single"
									bind:value={startTimeHour as any}
									disabled={submitting}
								>
									<Select.Trigger class="w-20">
										{startTimeHour || 'ชม'}
									</Select.Trigger>
									<Select.Content class="max-h-60">
										{#each hourOptions as option}
											<Select.Item value={option.value}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<span class="flex items-center text-gray-500">:</span>
								<Select.Root
									type="single"
									bind:value={startTimeMinute as any}
									disabled={submitting}
								>
									<Select.Trigger class="w-20">
										{startTimeMinute || 'นาที'}
									</Select.Trigger>
									<Select.Content class="max-h-60">
										{#each minuteOptions as option}
											<Select.Item value={option.value}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>

						<!-- End Time -->
						<div class="space-y-2">
							<Label class="flex items-center gap-2 text-base font-medium">
								<IconClock class="h-4 w-4" />
								เวลาสิ้นสุด *
							</Label>
							<input
								type="hidden"
								name="end_time"
								value={endTimeHour && endTimeMinute ? `${endTimeHour}:${endTimeMinute}` : (form?.formData?.end_time || extractTimeFromActivity(activity, false))}
							/>
							<div class="flex gap-2">
								<Select.Root
									type="single"
									bind:value={endTimeHour as any}
									disabled={submitting}
								>
									<Select.Trigger class="w-20">
										{endTimeHour || 'ชม'}
									</Select.Trigger>
									<Select.Content class="max-h-60">
										{#each hourOptions as option}
											<Select.Item value={option.value}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<span class="flex items-center text-gray-500">:</span>
								<Select.Root
									type="single"
									bind:value={endTimeMinute as any}
									disabled={submitting}
								>
									<Select.Trigger class="w-20">
										{endTimeMinute || 'นาที'}
									</Select.Trigger>
									<Select.Content class="max-h-60">
										{#each minuteOptions as option}
											<Select.Item value={option.value}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</div>
				</div>

				<!-- Eligible Faculties -->
				<div class="space-y-2">
					<Label for="eligible_organizations">หน่วยงานที่สามารถเข้าร่วมได้ *</Label>
					<input
						type="hidden"
						name="eligible_organizations"
						value={selectedEligibleValues.join(',')}
					/>
					<Select.Root
						type="multiple"
						bind:value={selectedEligibleValues as any}
						onValueChange={(values) => {
							if (values && Array.isArray(values)) {
								selectedEligibleValues = values as string[];
							}
						}}
					>
						<Select.Trigger>
							{#if selectedEligible.length === 0}
								เลือกหน่วยงานที่สามารถเข้าร่วมได้
							{:else if selectedEligible.length === 1}
								{selectedEligible[0].label}
							{:else}
								เลือกแล้ว {selectedEligible.length} หน่วยงาน
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each facultyOptions as option}
								<Select.Item value={option.value}>
									<div class="flex items-center gap-2">
										<div class="flex h-4 w-4 items-center justify-center">
											{#if selectedEligibleValues.includes(option.value)}
												<div class="h-3 w-3 rounded-sm bg-blue-600 border border-blue-600">
													<svg class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
														<path d="m6.564.75-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
													</svg>
												</div>
											{:else}
												<div class="h-3 w-3 rounded-sm border border-gray-300 bg-white"></div>
											{/if}
										</div>
										{option.label}
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

					{#if selectedEligible.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each selectedEligible as faculty}
								<span
									class="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800"
								>
									{faculty.label}
									<button
										type="button"
										onclick={() => {
											selectedEligibleValues = selectedEligibleValues.filter(
												(v) => v !== faculty.value
											);
										}}
										class="text-blue-600 hover:text-blue-800"
									>
										×
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Max Participants -->
				<div class="space-y-2">
					<Label for="max_participants">จำนวนผู้เข้าร่วมสูงสุด</Label>
					<Input
						id="max_participants"
						name="max_participants"
						type="number"
						min={currentParticipants || 1}
						placeholder="ไม่จำกัด"
						value={form?.formData?.max_participants || activity.max_participants || ''}
						class="text-base"
					/>
					<p class="text-sm text-muted-foreground">
						เว้นว่างหากไม่ต้องการจำกัดจำนวนผู้เข้าร่วม
						{#if currentParticipants > 0}
							(ขั้นต่ำ {currentParticipants} คน เนื่องจากมีผู้เข้าร่วมแล้ว)
						{/if}
					</p>
				</div>

				<!-- Status -->
				<div class="space-y-2">
					<Label for="status">สถานะกิจกรรม *</Label>
					<Select.Root type="single" bind:value={selectedStatus}>
						<Select.Trigger>
							{selectedStatus
								? statusOptions.find((s) => s.value === selectedStatus)?.label || 'เลือกสถานะ'
								: 'เลือกสถานะ'}
						</Select.Trigger>
						<Select.Content>
							{#each statusOptions as option}
								<Select.Item value={option.value}>
									<div class="flex flex-col items-start">
										<span class="font-medium">{option.label}</span>
										<span class="text-xs text-muted-foreground">{option.description}</span>
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if selectedStatus}
						{@const selectedOption = statusOptions.find((opt) => opt.value === selectedStatus)}
						{#if selectedOption}
							<p class="text-sm text-muted-foreground">
								{selectedOption.description}
							</p>
						{/if}
					{/if}
				</div>

				<!-- Registration toggle -->
				<input type="hidden" name="registration_open" value={registrationOpen ? '1' : '0'} />
				<div class="flex items-center gap-3">
					<Switch bind:checked={registrationOpen} />
					<Label>เปิดให้นักศึกษาลงทะเบียน (ใช้ได้เฉพาะสถานะ "เผยแพร่แล้ว")</Label>
				</div>

				<!-- Faculty assignment removed in favor of organization (หน่วยงาน) -->

				<!-- No department selection on edit page -->

				<!-- Admin Info -->
				<Alert>
					<IconInfoCircle class="size-4" />
					<AlertDescription>
						<div class="space-y-2">
							<p>คำแนะนำสำหรับผู้ดูแลระบบ:</p>
							<ul class="ml-4 list-disc space-y-1 text-sm">
								<li>การเปลี่ยนวันที่และเวลาอาจส่งผลกระทบต่อผู้ที่ลงทะเบียนไว้แล้ว</li>
								<li>การลดจำนวนผู้เข้าร่วมสูงสุดต้องไม่น้อยกว่าจำนวนผู้ที่ลงทะเบียนแล้ว</li>
								<li>การยกเลิกกิจกรรมจะส่งผลให้ผู้เข้าร่วมไม่สามารถดูข้อมูลได้</li>
								<li>การเปลี่ยนสถานะเป็น "เสร็จสิ้น" จะป้องกันการลงทะเบียนใหม่</li>
							</ul>
						</div>
					</AlertDescription>
				</Alert>

				<!-- Read-only extra fields (not editable in current API) -->
				<div class="grid gap-4 md:grid-cols-2">
					{#if activity.activity_type}
						<div>
							<Label>ประเภทกิจกรรม</Label>
							<p class="text-sm text-muted-foreground">{getActivityTypeDisplayName(activity.activity_type)}</p>
						</div>
					{/if}
					{#if activity.academic_year}
						<div>
							<Label>ปีการศึกษา</Label>
							<p class="text-sm text-muted-foreground">{activity.academic_year}</p>
						</div>
					{/if}
					{#if activity.hours}
						<div>
							<Label>ชั่วโมงกิจกรรม</Label>
							<p class="text-sm text-muted-foreground">{activity.hours}</p>
						</div>
					{/if}
				</div>

				<!-- Action Buttons -->
				<div class="flex flex-col gap-4 pt-4 sm:flex-row">
					<Button type="submit" disabled={submitting} class="flex-1 sm:flex-none">
						<IconDeviceFloppy class="mr-2 size-4" />
						{submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
					</Button>

					<Button type="button" variant="outline" onclick={goBack} disabled={submitting}>
						ยกเลิก
					</Button>

					<Button type="button" variant="ghost" onclick={goToList} disabled={submitting}>
						กลับสู่รายการกิจกรรม
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>

	<!-- Activity Current Info -->
	<Card>
		<CardHeader>
			<CardTitle class="text-lg">ข้อมูลปัจจุบันของกิจกรรม</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="grid gap-4 text-sm md:grid-cols-2">
				<div>
					<p class="font-medium text-muted-foreground">ผู้เข้าร่วมปัจจุบัน</p>
					<p class="text-lg font-semibold">
						{currentParticipants}
						{#if activity.max_participants}
							/ {activity.max_participants}
						{/if}
						คน
					</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">สร้างโดย</p>
					<p>{activity.created_by_name}</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">สร้างเมื่อ</p>
					<p>
						{new Date(activity.created_at).toLocaleDateString('th-TH', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						})}
					</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">แก้ไขล่าสุด</p>
					<p>
						{new Date(activity.updated_at).toLocaleDateString('th-TH', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						})}
					</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>

<style>
	:global(input[type='datetime-local']) {
		font-size: 0.875rem; /* text-sm */
	}

	/* Improve Select component readability */
	:global([data-radix-select-content]) {
		max-height: 400px;
	}
</style>
