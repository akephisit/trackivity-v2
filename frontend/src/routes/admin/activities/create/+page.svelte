<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { z } from 'zod';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import * as Form from '$lib/components/ui/form';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Separator } from '$lib/components/ui/separator';
	import {
		IconArrowLeft,
		IconLoader,
		IconCalendar,
		IconClock,
		IconMapPin,
		IconUsers,
		IconPlus
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import type { ActivityType } from '$lib/types/activity';
	import { type DateValue, getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';

	let { data } = $props();

	// Client-side validation schema (matches server)
	const activityCreateSchema = z
		.object({
			title: z
				.string()
				.min(1, 'กรุณากรอกชื่อกิจกรรม')
				.max(255, 'ชื่อกิจกรรมต้องไม่เกิน 255 ตัวอักษร'),
			description: z
				.string()
				.max(2000, 'รายละเอียดต้องไม่เกิน 2000 ตัวอักษร')
				.optional()
				.or(z.literal('')),
			start_date: z
				.string()
				.min(1, 'กรุณาเลือกวันที่เริ่ม')
				.refine((date) => {
					const d = new Date(date);
					return !isNaN(d.getTime());
				}, 'วันที่เริ่มไม่ถูกต้อง'),
			end_date: z
				.string()
				.min(1, 'กรุณาเลือกวันที่สิ้นสุด')
				.refine((date) => {
					const d = new Date(date);
					return !isNaN(d.getTime());
				}, 'วันที่สิ้นสุดไม่ถูกต้อง'),
			start_time: z
				.string()
				.min(1, 'กรุณากรอกเวลาเริ่ม')
				.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)'),
			end_time: z
				.string()
				.min(1, 'กรุณากรอกเวลาสิ้นสุด')
				.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)'),
			activity_type: z.enum(['Academic', 'Sports', 'Cultural', 'Social', 'Other'], {
				errorMap: () => ({ message: 'กรุณาเลือกประเภทกิจกรรม' })
			}),
			location: z.string().min(1, 'กรุณากรอกสถานที่').max(500, 'สถานที่ต้องไม่เกิน 500 ตัวอักษร'),
			max_participants: z.string().optional(),
			hours: z
				.string()
				.min(1, 'กรุณากรอกจำนวนชั่วโมง')
				.regex(/^\d+$/, 'ชั่วโมงต้องเป็นจำนวนเต็ม')
				.refine((v) => parseInt(v) > 0, 'ชั่วโมงต้องมากกว่า 0'),
			organizer_id: z.string().min(1, 'กรุณาเลือกหน่วยงานที่จัดกิจกรรม')
		})
		.refine(
			(data) => {
				const startDate = new Date(data.start_date);
				const endDate = new Date(data.end_date);
				return endDate >= startDate;
			},
			{
				message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น',
				path: ['end_date']
			}
		)
		.refine(
			(data) => {
				// If same date, check that end time is after start time
				if (data.start_date === data.end_date) {
					const [startHour, startMin] = data.start_time.split(':').map(Number);
					const [endHour, endMin] = data.end_time.split(':').map(Number);
					const startMinutes = startHour * 60 + startMin;
					const endMinutes = endHour * 60 + endMin;
					return endMinutes > startMinutes;
				}
				return true;
			},
			{
				message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น',
				path: ['end_time']
			}
		);

	// Form setup
	const form = superForm(data.form, {
		validators: zodClient(activityCreateSchema),
		onResult: async ({ result }) => {
			if (result.type === 'success') {
				toast.success('สร้างกิจกรรมสำเร็จ');
				// นำทางไปหน้ารายการโดยไม่ต้องพึ่ง query param
				setTimeout(() => {
					goto('/admin/activities');
				}, 50);
			} else if (result.type === 'failure') {
				toast.error(result.data?.error || 'เกิดข้อผิดพลาดในการสร้างกิจกรรม');
			}
		}
	});

	const { form: formData, enhance, errors, submitting } = form;

	// Activity type options
	const activityTypeOptions: { value: ActivityType; label: string; description: string }[] = [
		{ value: 'Academic', label: 'วิชาการ', description: 'กิจกรรมทางการศึกษาและการเรียนรู้' },
		{ value: 'Sports', label: 'กีฬา', description: 'กิจกรรมกีฬาและการออกกำลังกาย' },
		{ value: 'Cultural', label: 'วัฒนธรรม', description: 'กิจกรรมด้านศิลปะและวัฒนธรรม' },
		{ value: 'Social', label: 'สังคม', description: 'กิจกรรมเพื่อสังคมและการพัฒนาชุมชน' },
		{ value: 'Other', label: 'อื่นๆ', description: 'กิจกรรมประเภทอื่นๆ' }
	];

	// Parse organization data from API - now includes both faculty and office types
	const organizationData = data.organizations || { all: [], grouped: { faculty: [], office: [] } };

	// Create options for each organization type with Thai labels
	const facultyOptions = organizationData.grouped.faculty.map((faculty: any) => ({
		value: faculty.id,
		label: faculty.name,
		type: 'faculty' as const
	}));

	const officeOptions = organizationData.grouped.office.map((office: any) => ({
		value: office.id,
		label: office.name,
		type: 'office' as const
	}));

	// Combine all options for form processing
	const allOrganizationOptions = [...facultyOptions, ...officeOptions];

	// Import utility functions and options

	import { formatThaiDate } from '$lib/utils/thai-date';

	// Note: We now use Thai formatting utilities instead of the standard DateFormatter

	// Create custom month and year formatting functions for calendar
	function formatCalendarMonth(monthNumber: number): string {
		const monthIndex = monthNumber - 1; // Convert to 0-based index
		return formatThaiMonth(monthIndex, 'long');
	}

	function formatCalendarYear(year: number): string {
		return toBuddhistEra(year).toString();
	}

	// Import Thai date utilities for calendar customization
	import { formatThaiMonth, toBuddhistEra } from '$lib/utils/thai-date';

	// Activity level options with English values and Thai labels

	// Selected values for selects - sync with form defaults
	let selectedActivityType = $state<{ value: ActivityType; label: string } | undefined>(
		activityTypeOptions.find((opt) => opt.value === $formData.activity_type)
	);

	// Date picker values
	let startDateValue = $state<DateValue | undefined>(undefined);
	let endDateValue = $state<DateValue | undefined>(undefined);

	// Time picker values
	let startTimeHour = $state<string>('');
	let startTimeMinute = $state<string>('');
	let endTimeHour = $state<string>('');
	let endTimeMinute = $state<string>('');

	// Helper functions
	function goBack() {
		goto('/admin/activities');
	}

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

	// Synchronize DateValue with form data
	$effect(() => {
		// Convert form date strings to DateValue objects
		if ($formData.start_date && !startDateValue) {
			try {
				startDateValue = parseDate($formData.start_date);
			} catch (e) {
				// Invalid date format, ignore
			}
		}
		if ($formData.end_date && !endDateValue) {
			try {
				endDateValue = parseDate($formData.end_date);
			} catch (e) {
				// Invalid date format, ignore
			}
		}
	});

	// Convert DateValue changes to form data
	$effect(() => {
		if (startDateValue) {
			$formData.start_date = startDateValue.toString();
		}
	});

	$effect(() => {
		if (endDateValue) {
			$formData.end_date = endDateValue.toString();
		}
	});

	// Synchronize time values with form data
	$effect(() => {
		// Parse existing start time
		if ($formData.start_time && !startTimeHour) {
			const [hour, minute] = $formData.start_time.split(':');
			startTimeHour = hour || '';
			startTimeMinute = minute || '';
		}
	});

	$effect(() => {
		// Parse existing end time
		if ($formData.end_time && !endTimeHour) {
			const [hour, minute] = $formData.end_time.split(':');
			endTimeHour = hour || '';
			endTimeMinute = minute || '';
		}
	});

	// Update form data when time values change
	$effect(() => {
		if (startTimeHour && startTimeMinute) {
			$formData.start_time = `${startTimeHour}:${startTimeMinute}`;
		}
	});

	$effect(() => {
		if (endTimeHour && endTimeMinute) {
			$formData.end_time = `${endTimeHour}:${endTimeMinute}`;
		}
	});

	// Reactive validation for dates
	$effect(() => {
		if ($formData.start_date && $formData.end_date) {
			const startDate = new Date($formData.start_date);
			const endDate = new Date($formData.end_date);

			if (endDate < startDate) {
				// This will be caught by the schema validation
			}
		}
	});
</script>

<svelte:head>
	<title>สร้างกิจกรรมใหม่ - Trackivity</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={goBack} class="text-gray-600 hover:text-gray-800">
				<IconArrowLeft class="mr-2 h-4 w-4" />
				กลับ
			</Button>
			<div>
				<h1 class="admin-page-title">
					<IconCalendar class="size-6 text-primary" /> สร้างกิจกรรมใหม่
				</h1>
				<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
					กรอกข้อมูลเพื่อสร้างกิจกรรมใหม่ในระบบ
				</p>
			</div>
		</div>
	</div>

	<!-- Main Form -->
	<div class="max-w-4xl">
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-3">
					<IconPlus class="h-6 w-6 text-blue-600" />
					รายละเอียดกิจกรรม
				</CardTitle>
				<CardDescription>กรอกข้อมูลทั่วไปของกิจกรรม</CardDescription>
			</CardHeader>
			<CardContent>
				<form method="POST" use:enhance class="space-y-6">
					<!-- Error Display -->
					{#if $errors._errors}
						<Alert variant="destructive">
							<AlertDescription>
								{$errors._errors[0]}
							</AlertDescription>
						</Alert>
					{/if}

					<!-- Basic Information -->
					<div class="space-y-6">
						<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<!-- Activity Name -->
							<div class="lg:col-span-2">
								<Form.Field {form} name="title">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="text-base font-medium">ชื่อกิจกรรม *</Label>
											<Input
												{...props}
												bind:value={$formData.title}
												placeholder="เช่น การบรรยายพิเศษเรื่องเทคโนโลยีใหม่"
												disabled={$submitting}
												class="text-base"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- Activity Type -->
							<div>
								<Form.Field {form} name="activity_type">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="text-base font-medium">ประเภทกิจกรรม *</Label>
											<input
												type="hidden"
												name="activity_type"
												bind:value={$formData.activity_type}
											/>
											<Select.Root
												type="single"
												bind:value={selectedActivityType as any}
												disabled={$submitting}
												onValueChange={(value) => {
													const newType = value as ActivityType;
													const option = activityTypeOptions.find((opt) => opt.value === newType);
													if (option) {
														selectedActivityType = { value: option.value, label: option.label };
														$formData.activity_type = option.value;
													}
												}}
											>
												<Select.Trigger>
													{selectedActivityType?.label ?? 'เลือกประเภทกิจกรรม'}
												</Select.Trigger>
												<Select.Content>
													{#each activityTypeOptions as option}
														<Select.Item value={option.value}>
															<div class="flex flex-col">
																<span class="font-medium">{option.label}</span>
																<span class="text-sm text-gray-500">{option.description}</span>
															</div>
														</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- Academic Year -->

							<!-- Organizer (select from organizations) -->
							<div>
								<Form.Field {form} name="organizer_id">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="text-base font-medium"
												>หน่วยงานที่จัดกิจกรรม *</Label
											>
											<input
												type="hidden"
												name="organizer_id"
												bind:value={$formData.organizer_id}
											/>
											<Select.Root
												type="single"
												bind:value={$formData.organizer_id as any}
												disabled={$submitting}
											>
												<Select.Trigger>
													{#if $formData.organizer_id}
														{allOrganizationOptions.find(
															(o: { value: string; label: string }) =>
																o.value === $formData.organizer_id
														)?.label || 'เลือกหน่วยงานผู้จัด'}
													{:else}
														เลือกหน่วยงานผู้จัด
													{/if}
												</Select.Trigger>
												<Select.Content>
													<!-- คณะ Section -->
													{#if facultyOptions.length > 0}
														<div class="bg-gray-50 px-2 py-1.5 text-sm font-semibold text-gray-700">
															คณะ
														</div>
														{#each facultyOptions as option}
															<Select.Item value={option.value}>
																<div class="flex items-center gap-2">
																	<div class="h-2 w-2 rounded-full bg-blue-500"></div>
																	{option.label}
																</div>
															</Select.Item>
														{/each}
													{/if}

													<!-- หน่วยงาน Section -->
													{#if officeOptions.length > 0}
														{#if facultyOptions.length > 0}
															<div class="my-1 border-t"></div>
														{/if}
														<div class="bg-gray-50 px-2 py-1.5 text-sm font-semibold text-gray-700">
															หน่วยงาน
														</div>
														{#each officeOptions as option}
															<Select.Item value={option.value}>
																<div class="flex items-center gap-2">
																	<div class="h-2 w-2 rounded-full bg-green-500"></div>
																	{option.label}
																</div>
															</Select.Item>
														{/each}
													{/if}
												</Select.Content>
											</Select.Root>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>
						</div>

						<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<!-- Location -->
							<div>
								<Form.Field {form} name="location">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2 text-base font-medium">
												<IconMapPin class="h-4 w-4" />
												สถานที่ *
											</Label>
											<Input
												{...props}
												bind:value={$formData.location}
												placeholder="เช่น ห้องประชุมใหญ่ อาคาร A"
												disabled={$submitting}
												class="text-base"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- Eligible Faculties -->
						</div>

						<!-- Description -->
						<div>
							<Form.Field {form} name="description">
								<Form.Control>
									{#snippet children({ props })}
										<Label for={props.id} class="text-base font-medium">รายละเอียดกิจกรรม</Label>
										<Textarea
											{...props}
											bind:value={$formData.description}
											placeholder="อธิบายรายละเอียดของกิจกรรม วัตถุประสงค์ และสิ่งที่ผู้เข้าร่วมจะได้รับ (ไม่บังคับ)"
											disabled={$submitting}
											rows={4}
											class="text-base"
										/>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors />
							</Form.Field>
						</div>
					</div>

					<Separator />

					<!-- Date and Time -->
					<div class="space-y-6">
						<h3 class="flex items-center gap-2 text-lg font-semibold">
							<IconCalendar class="h-5 w-5 text-blue-600" />
							วันที่และเวลา
						</h3>

						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<!-- Start Date -->
							<div>
								<Form.Field {form} name="start_date">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="text-base font-medium">วันที่เริ่ม *</Label>
											<input type="hidden" name="start_date" bind:value={$formData.start_date} />
											<Popover.Root>
												<Popover.Trigger
													class={cn(
														buttonVariants({
															variant: 'outline',
															class: 'w-full justify-start text-left text-base font-normal'
														}),
														!startDateValue && 'text-muted-foreground'
													)}
													disabled={$submitting}
												>
													<IconCalendar class="mr-2 h-4 w-4" />
													{startDateValue ? formatThaiDate(startDateValue) : 'เลือกวันที่เริ่ม'}
												</Popover.Trigger>
												<Popover.Content class="w-auto p-0">
													<Calendar
														type="single"
														bind:value={startDateValue}
														minValue={today(getLocalTimeZone())}
														disabled={$submitting}
														locale="th-TH"
														captionLayout="dropdown"
														monthFormat={formatCalendarMonth}
														yearFormat={formatCalendarYear}
													/>
												</Popover.Content>
											</Popover.Root>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- End Date -->
							<div>
								<Form.Field {form} name="end_date">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="text-base font-medium">วันที่สิ้นสุด *</Label>
											<input type="hidden" name="end_date" bind:value={$formData.end_date} />
											<Popover.Root>
												<Popover.Trigger
													class={cn(
														buttonVariants({
															variant: 'outline',
															class: 'w-full justify-start text-left text-base font-normal'
														}),
														!endDateValue && 'text-muted-foreground'
													)}
													disabled={$submitting}
												>
													<IconCalendar class="mr-2 h-4 w-4" />
													{endDateValue ? formatThaiDate(endDateValue) : 'เลือกวันที่สิ้นสุด'}
												</Popover.Trigger>
												<Popover.Content class="w-auto p-0">
													<Calendar
														type="single"
														bind:value={endDateValue}
														minValue={startDateValue || today(getLocalTimeZone())}
														disabled={$submitting}
														locale="th-TH"
														captionLayout="dropdown"
														monthFormat={formatCalendarMonth}
														yearFormat={formatCalendarYear}
													/>
												</Popover.Content>
											</Popover.Root>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- Start Time -->
							<div>
								<Form.Field {form} name="start_time">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2 text-base font-medium">
												<IconClock class="h-4 w-4" />
												เวลาเริ่ม *
											</Label>
											<input type="hidden" name="start_time" bind:value={$formData.start_time} />
											<div class="flex gap-2">
												<Select.Root
													type="single"
													bind:value={startTimeHour as any}
													disabled={$submitting}
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
													disabled={$submitting}
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
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- End Time -->
							<div>
								<Form.Field {form} name="end_time">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2 text-base font-medium">
												<IconClock class="h-4 w-4" />
												เวลาสิ้นสุด *
											</Label>
											<input type="hidden" name="end_time" bind:value={$formData.end_time} />
											<div class="flex gap-2">
												<Select.Root
													type="single"
													bind:value={endTimeHour as any}
													disabled={$submitting}
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
													disabled={$submitting}
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
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>
						</div>
					</div>

					<Separator />

					<!-- Additional Settings -->
					<div class="space-y-6">
						<h3 class="flex items-center gap-2 text-lg font-semibold">
							<IconUsers class="h-5 w-5 text-blue-600" />
							การตั้งค่าเพิ่มเติม
						</h3>

						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<!-- Max Participants -->
							<div>
								<Form.Field {form} name="max_participants">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2 text-base font-medium">
												<IconUsers class="h-4 w-4" />
												จำนวนผู้เข้าร่วมสูงสุด
											</Label>
											<Input
												{...props}
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												bind:value={$formData.max_participants}
												placeholder="ไม่จำกัด"
												disabled={$submitting}
												class="text-base"
											/>
											<p class="mt-1 text-sm text-gray-500">หากไม่กรอก จะถือว่าไม่จำกัดจำนวน</p>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- Activity Hours -->
							<div>
								<Form.Field {form} name="hours">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2 text-base font-medium">
												<IconClock class="h-4 w-4" />
												ชั่วโมงกิจกรรม (ชั่วโมง) *
											</Label>
											<Input
												{...props}
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												bind:value={$formData.hours}
												placeholder="เช่น 2"
												disabled={$submitting}
												class="text-base"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>
						</div>
					</div>

					<!-- Submit Buttons -->
					<div class="flex justify-end gap-4 pt-6">
						<Button type="button" variant="outline" onclick={goBack} disabled={$submitting}>
							ยกเลิก
						</Button>
						<Button type="submit" disabled={$submitting} class="bg-blue-600 hover:bg-blue-700">
							{#if $submitting}
								<IconLoader class="mr-2 h-4 w-4 animate-spin" />
								กำลังสร้าง...
							{:else}
								<IconPlus class="mr-2 h-4 w-4" />
								สร้างกิจกรรม
							{/if}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
