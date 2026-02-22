<script lang="ts">
	import {
		activities as activitiesApi,
		organizations as orgsApi,
		type Organization
	} from '$lib/api';
	import { activityTypeOptions, activityLevelOptions } from '$lib/utils/activity';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import {
		IconArrowLeft,
		IconCalendar,
		IconClock,
		IconMapPin,
		IconPlus
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { type DateValue, parseDate } from '@internationalized/date';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import { formatThaiMonth, toBuddhistEra } from '$lib/utils/thai-date';

	// ─── State ─────────────────────────────────────────────────────────────────
	let orgs = $state<Organization[]>([]);
	let submitting = $state(false);
	let errors = $state<Record<string, string>>({});

	// Basic fields
	let title = $state('');
	let description = $state('');
	let location = $state('');
	let activityType = $state('Academic');
	let activityLevel = $state('faculty');
	let organizerId = $state('');
	let hours = $state('');
	let maxParticipants = $state('');
	let registrationOpen = $state(false);
	let eligibleOrgs = $state<string[]>([]);

	// Date pickers
	let startDateValue = $state<DateValue | undefined>(undefined);
	let endDateValue = $state<DateValue | undefined>(undefined);

	// Time selects
	let startTimeHour = $state('');
	let startTimeMinute = $state('');
	let endTimeHour = $state('');
	let endTimeMinute = $state('');

	// ─── Load orgs ─────────────────────────────────────────────────────────────
	onMount(async () => {
		try {
			const data = await orgsApi.list();
			orgs = data.all;
		} catch {
			toast.error('ไม่สามารถโหลดรายการหน่วยงานได้');
		}
	});

	// ─── Helpers ───────────────────────────────────────────────────────────────
	function generateHourOptions() {
		return Array.from({ length: 24 }, (_, i) => {
			const h = i.toString().padStart(2, '0');
			return { value: h, label: h };
		});
	}
	function generateMinuteOptions() {
		return Array.from({ length: 12 }, (_, i) => {
			const m = (i * 5).toString().padStart(2, '0');
			return { value: m, label: m };
		});
	}

	const hourOptions = generateHourOptions();
	const minuteOptions = generateMinuteOptions();

	function formatDateLabel(d: DateValue | undefined): string {
		if (!d) return 'เลือกวันที่';
		return `${toBuddhistEra(d.year)}/${String(d.month).padStart(2, '0')}/${String(d.day).padStart(2, '0')}`;
	}

	// ─── Selected eligible orgs (derived display) ──────────────────────────────
	let selectedEligibleDisplay = $derived(
		eligibleOrgs.map((id) => {
			const org = orgs.find((o) => o.id === id);
			return { value: id, label: org?.name || id };
		})
	);

	// ─── Validate ──────────────────────────────────────────────────────────────
	function validate() {
		const e: Record<string, string> = {};
		if (!title.trim()) e.title = 'กรุณากรอกชื่อกิจกรรม';
		if (!startDateValue) e.start_date = 'กรุณาเลือกวันที่เริ่ม';
		if (!endDateValue) e.end_date = 'กรุณาเลือกวันที่สิ้นสุด';
		if (!startTimeHour || !startTimeMinute) e.start_time = 'กรุณาเลือกเวลาเริ่ม';
		if (!endTimeHour || !endTimeMinute) e.end_time = 'กรุณาเลือกเวลาสิ้นสุด';
		if (!location.trim()) e.location = 'กรุณากรอกสถานที่';
		if (!hours || Number(hours) <= 0) e.hours = 'กรุณากรอกชั่วโมงกิจกรรม';
		if (!activityType) e.activity_type = 'กรุณาเลือกประเภทกิจกรรม';
		if (!organizerId) e.organizer_id = 'กรุณาเลือกหน่วยงานที่จัดกิจกรรม';
		if (startDateValue && endDateValue && endDateValue.compare(startDateValue) < 0) {
			e.end_date = 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น';
		}
		errors = e;
		return Object.keys(e).length === 0;
	}

	// ─── Submit ────────────────────────────────────────────────────────────────
	async function handleSubmit() {
		if (!validate() || submitting) return;
		submitting = true;
		try {
			await activitiesApi.create({
				title,
				description: description || null,
				location,
				activity_type: activityType,
				activity_level: activityLevel,
				start_date: startDateValue!.toString(),
				end_date: endDateValue!.toString(),
				start_time_only: `${startTimeHour}:${startTimeMinute}:00`,
				end_time_only: `${endTimeHour}:${endTimeMinute}:00`,
				hours: Number(hours),
				max_participants: maxParticipants ? Number(maxParticipants) : null,
				organizer_id: organizerId,
				registration_open: registrationOpen,
				eligible_organizations: eligibleOrgs
			});
			toast.success('สร้างกิจกรรมสำเร็จ');
			goto('/admin/activities');
		} catch (e: any) {
			toast.error(e?.message || 'เกิดข้อผิดพลาดในการสร้างกิจกรรม');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>สร้างกิจกรรมใหม่ - Trackivity</title></svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" onclick={() => goto('/admin/activities')}>
			<IconArrowLeft class="mr-2 size-4" />กลับ
		</Button>
		<div>
			<h1 class="admin-page-title flex items-center gap-2">
				<IconCalendar class="size-6 text-primary" /> สร้างกิจกรรมใหม่
			</h1>
			<p class="text-sm text-muted-foreground">กรอกข้อมูลกิจกรรมที่ต้องการสร้าง</p>
		</div>
	</div>

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">

		<!-- ─── ข้อมูลพื้นฐาน ─────────────────────────────────────────────── -->
		<Card>
			<CardHeader><CardTitle>ข้อมูลพื้นฐาน</CardTitle></CardHeader>
			<CardContent class="space-y-4">

				<!-- ชื่อกิจกรรม -->
				<div class="space-y-2">
					<Label for="title">ชื่อกิจกรรม *</Label>
					<Input id="title" bind:value={title} placeholder="กรอกชื่อกิจกรรม" />
					{#if errors.title}<p class="text-sm text-red-500">{errors.title}</p>{/if}
				</div>

				<!-- รายละเอียด -->
				<div class="space-y-2">
					<Label for="description">รายละเอียด</Label>
					<Textarea id="description" bind:value={description} placeholder="รายละเอียดกิจกรรม (ไม่บังคับ)" rows={4} class="resize-none" />
				</div>

				<!-- ประเภทกิจกรรม + ระดับกิจกรรม -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label>ประเภทกิจกรรม *</Label>
						<Select.Root type="single" bind:value={activityType}>
							<Select.Trigger class="w-full">
								{activityTypeOptions.find((o) => o.value === activityType)?.label || 'เลือกประเภท'}
							</Select.Trigger>
							<Select.Content>
								{#each activityTypeOptions as opt}
									<Select.Item value={opt.value}>{opt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if errors.activity_type}<p class="text-sm text-red-500">{errors.activity_type}</p>{/if}
					</div>

					<div class="space-y-2">
						<Label>ระดับกิจกรรม *</Label>
						<Select.Root type="single" bind:value={activityLevel}>
							<Select.Trigger class="w-full">
								{activityLevelOptions.find((o) => o.value === activityLevel)?.label || 'เลือกระดับ'}
							</Select.Trigger>
							<Select.Content>
								{#each activityLevelOptions as opt}
									<Select.Item value={opt.value}>
										<div class="flex flex-col">
											<span class="font-medium">{opt.label}</span>
											<span class="text-xs text-muted-foreground">{opt.description}</span>
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- หน่วยงานผู้จัด -->
				<div class="space-y-2">
					<Label>หน่วยงานที่จัดกิจกรรม *</Label>
					<Select.Root type="single" bind:value={organizerId}>
						<Select.Trigger class="w-full">
							{orgs.find((o) => o.id === organizerId)?.name || 'เลือกหน่วยงาน'}
						</Select.Trigger>
						<Select.Content>
							{#each orgs as org}
								<Select.Item value={org.id}>{org.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if errors.organizer_id}<p class="text-sm text-red-500">{errors.organizer_id}</p>{/if}
				</div>

				<!-- หน่วยงานที่เข้าร่วมได้ -->
				<div class="space-y-2">
					<Label>หน่วยงานที่เข้าร่วมได้ (เลือกได้หลายหน่วยงาน)</Label>
					<Select.Root type="multiple" bind:value={eligibleOrgs as any}>
						<Select.Trigger class="w-full">
							{eligibleOrgs.length > 0 ? `เลือกแล้ว ${eligibleOrgs.length} หน่วยงาน` : 'เลือกหน่วยงานที่เข้าร่วมได้'}
						</Select.Trigger>
						<Select.Content class="max-h-64 overflow-y-auto">
							{#each orgs as org}
								<Select.Item value={org.id}>{org.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if selectedEligibleDisplay.length > 0}
						<div class="flex flex-wrap gap-1 pt-1">
							{#each selectedEligibleDisplay as org}
								<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
									{org.label}
									<button
										type="button"
										onclick={() => eligibleOrgs = eligibleOrgs.filter((v) => v !== org.value)}
										class="ml-1 text-muted-foreground hover:text-foreground"
									>×</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

			</CardContent>
		</Card>

		<!-- ─── วันที่และเวลา ──────────────────────────────────────────────── -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconClock class="size-5" />วันที่และเวลา
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">

				<!-- วันที่ -->
				<div class="grid gap-4 sm:grid-cols-2">
					<!-- วันที่เริ่ม -->
					<div class="space-y-2">
						<Label>วันที่เริ่ม *</Label>
						<Popover.Root>
							<Popover.Trigger
								class={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start text-left font-normal')}
							>
								<IconCalendar class="mr-2 size-4" />
								{formatDateLabel(startDateValue)}
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0" align="start">
								<Calendar type="single" bind:value={startDateValue} calendarLabel="วันที่เริ่ม" />
							</Popover.Content>
						</Popover.Root>
						{#if errors.start_date}<p class="text-sm text-red-500">{errors.start_date}</p>{/if}
					</div>

					<!-- วันที่สิ้นสุด -->
					<div class="space-y-2">
						<Label>วันที่สิ้นสุด *</Label>
						<Popover.Root>
							<Popover.Trigger
								class={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start text-left font-normal')}
							>
								<IconCalendar class="mr-2 size-4" />
								{formatDateLabel(endDateValue)}
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0" align="start">
								<Calendar type="single" bind:value={endDateValue} calendarLabel="วันที่สิ้นสุด" />
							</Popover.Content>
						</Popover.Root>
						{#if errors.end_date}<p class="text-sm text-red-500">{errors.end_date}</p>{/if}
					</div>
				</div>

				<!-- เวลา -->
				<div class="grid gap-4 sm:grid-cols-2">
					<!-- เวลาเริ่ม -->
					<div class="space-y-2">
						<Label>เวลาเริ่ม *</Label>
						<div class="flex items-center gap-2">
							<Select.Root type="single" bind:value={startTimeHour as any}>
								<Select.Trigger class="flex-1">
									{startTimeHour || 'ชั่วโมง'}
								</Select.Trigger>
								<Select.Content class="max-h-48 overflow-y-auto">
									{#each hourOptions as opt}
										<Select.Item value={opt.value}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<span class="font-medium">:</span>
							<Select.Root type="single" bind:value={startTimeMinute as any}>
								<Select.Trigger class="flex-1">
									{startTimeMinute || 'นาที'}
								</Select.Trigger>
								<Select.Content class="max-h-48 overflow-y-auto">
									{#each minuteOptions as opt}
										<Select.Item value={opt.value}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						{#if errors.start_time}<p class="text-sm text-red-500">{errors.start_time}</p>{/if}
					</div>

					<!-- เวลาสิ้นสุด -->
					<div class="space-y-2">
						<Label>เวลาสิ้นสุด *</Label>
						<div class="flex items-center gap-2">
							<Select.Root type="single" bind:value={endTimeHour as any}>
								<Select.Trigger class="flex-1">
									{endTimeHour || 'ชั่วโมง'}
								</Select.Trigger>
								<Select.Content class="max-h-48 overflow-y-auto">
									{#each hourOptions as opt}
										<Select.Item value={opt.value}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<span class="font-medium">:</span>
							<Select.Root type="single" bind:value={endTimeMinute as any}>
								<Select.Trigger class="flex-1">
									{endTimeMinute || 'นาที'}
								</Select.Trigger>
								<Select.Content class="max-h-48 overflow-y-auto">
									{#each minuteOptions as opt}
										<Select.Item value={opt.value}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						{#if errors.end_time}<p class="text-sm text-red-500">{errors.end_time}</p>{/if}
					</div>
				</div>

			</CardContent>
		</Card>

		<!-- ─── สถานที่และจำนวน ─────────────────────────────────────────────── -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconMapPin class="size-5" />สถานที่และจำนวนผู้เข้าร่วม
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">

				<div class="space-y-2">
					<Label for="location">สถานที่จัดกิจกรรม *</Label>
					<Input id="location" bind:value={location} placeholder="ระบุสถานที่จัดกิจกรรม" />
					{#if errors.location}<p class="text-sm text-red-500">{errors.location}</p>{/if}
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="hours">ชั่วโมงกิจกรรม *</Label>
						<Input id="hours" type="number" min="1" bind:value={hours} placeholder="จำนวนชั่วโมง" />
						{#if errors.hours}<p class="text-sm text-red-500">{errors.hours}</p>{/if}
					</div>
					<div class="space-y-2">
						<Label for="max_participants">จำนวนที่รับได้สูงสุด</Label>
						<Input id="max_participants" type="number" min="1" bind:value={maxParticipants} placeholder="ไม่จำกัด (ถ้าเว้นว่าง)" />
					</div>
				</div>

				<!-- เปิดรับลงทะเบียน -->
				<div class="flex items-center gap-3 rounded-lg border p-3">
					<Switch bind:checked={registrationOpen} />
					<div>
						<Label class="cursor-pointer">เปิดให้นักศึกษาลงทะเบียน</Label>
						<p class="text-xs text-muted-foreground">สามารถเปิด/ปิดได้ภายหลังเมื่อกิจกรรมถูกเผยแพร่</p>
					</div>
				</div>

			</CardContent>
		</Card>

		<!-- ─── Actions ─────────────────────────────────────────────────────── -->
		<div class="flex gap-4">
			<Button type="submit" disabled={submitting} class="flex items-center gap-2">
				<IconPlus class="size-4" />
				{submitting ? 'กำลังสร้าง...' : 'สร้างกิจกรรม'}
			</Button>
			<Button type="button" variant="outline" onclick={() => goto('/admin/activities')}>ยกเลิก</Button>
		</div>

	</form>
</div>
