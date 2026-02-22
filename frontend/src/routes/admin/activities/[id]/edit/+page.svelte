<script lang="ts">
	import { activitiesApi, organizationsApi, type Activity } from '$lib/api';
	import type { ActivityStatus } from '$lib/types/activity';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
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
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { type DateValue, parseDate, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import { formatThaiDate, formatThaiMonth, toBuddhistEra } from '$lib/utils/thai-date';
	import { onMount } from 'svelte';
	import { activityLevelOptions } from '$lib/utils/activity';

	// ─── State ─────────────────────────────────────────────────────────────────
	let activity = $state<Activity | null>(null);
	let faculties = $state<{ id: string; name: string }[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let submitting = $state(false);

	// Form state (initialised after data loads)
	let selectedStatus = $state<ActivityStatus>('draft');
	let registrationOpen = $state(false);
	let selectedOrganizerId = $state('');
	let selectedActivityLevel = $state('faculty');
	let selectedEligibleValues = $state<string[]>([]);

	// Date/time pickers
	let startDateValue = $state<DateValue | undefined>(undefined);
	let endDateValue = $state<DateValue | undefined>(undefined);
	let startTimeHour = $state('');
	let startTimeMinute = $state('');
	let endTimeHour = $state('');
	let endTimeMinute = $state('');

	// Form fields (bound to inputs)
	let titleValue = $state('');
	let descriptionValue = $state('');
	let locationValue = $state('');
	let maxParticipantsValue = $state('');

	// ─── Load data on mount ────────────────────────────────────────────────────
	onMount(async () => {
		const id = page.params.id!;
		try {
			const [act, orgs] = await Promise.all([
				activitiesApi.get(id),
				organizationsApi.listAdmin()
			]);
			activity = act;
			faculties = orgs as any[];

			// Initialise form from loaded data
			selectedStatus = act.status as ActivityStatus;
			registrationOpen = !!act.registration_open;
			selectedOrganizerId = (act as any).organizer_id || '';
			selectedActivityLevel = (act as any).activity_level || 'faculty';
			selectedEligibleValues = Array.isArray((act as any).eligible_organizations)
				? (act as any).eligible_organizations
				: [];

			titleValue = act.title || '';
			descriptionValue = act.description || '';
			locationValue = act.location || '';
			maxParticipantsValue = act.max_participants != null ? String(act.max_participants) : '';

			// Init date pickers
			const startDateStr = extractDateStr(act, 'start');
			if (startDateStr) {
				try { startDateValue = parseDate(startDateStr); } catch {}
			}
			const endDateStr = extractDateStr(act, 'end');
			if (endDateStr) {
				try { endDateValue = parseDate(endDateStr); } catch {}
			}

			// Init time pickers
			const st = extractTimeStr(act, true);
			if (st) { const [h, m] = st.split(':'); startTimeHour = h; startTimeMinute = m; }
			const et = extractTimeStr(act, false);
			if (et) { const [h, m] = et.split(':'); endTimeHour = h; endTimeMinute = m; }

		} catch (e: any) {
			if (e?.status === 404) notFound = true;
			else toast.error('ไม่สามารถโหลดข้อมูลกิจกรรมได้');
		} finally {
			loading = false;
		}
	});

	// ─── Helpers ───────────────────────────────────────────────────────────────
	function extractDateStr(act: any, which: 'start' | 'end'): string {
		const field = which === 'start' ? 'start_date' : 'end_date';
		if (act[field]) return act[field];
		const dt = which === 'start' ? act.start_time : act.end_time;
		if (dt) return new Date(dt).toISOString().split('T')[0];
		return '';
	}

	function extractTimeStr(act: any, isStart: boolean): string {
		const field = isStart ? 'start_time_only' : 'end_time_only';
		if (act[field]) {
			const parts = act[field].toString().split(':');
			if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
		}
		return '';
	}

	function formatCalendarMonth(m: number) { return formatThaiMonth(m - 1, 'long'); }
	function formatCalendarYear(y: number) { return toBuddhistEra(y).toString(); }

	function formatDateLabel(d: DateValue | undefined): string {
		if (!d) return 'เลือกวันที่';
		const jsDate = d.toDate(getLocalTimeZone());
		return new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }).format(jsDate);
	}

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

	// ─── Derived ───────────────────────────────────────────────────────────────
	let facultyOptions = $derived(
		faculties.map((f: any) => ({ value: f.id, label: f.name }))
	);

	let selectedEligible = $derived(
		selectedEligibleValues.map((id) => {
			const opt = facultyOptions.find((o) => o.value === id);
			return { value: id, label: opt?.label || id };
		})
	);

	let currentParticipants = $derived((activity as any)?.participant_count || 0);

	let isSuperAdmin = $derived(false); // Will be set from auth store if needed

	const statusOptions: { value: ActivityStatus; label: string; description: string }[] = [
		{ value: 'draft', label: 'ร่าง', description: 'กิจกรรมยังไม่เผยแพร่ มองเห็นได้เฉพาะผู้จัดการ' },
		{ value: 'published', label: 'เผยแพร่แล้ว', description: 'กิจกรรมเผยแพร่แล้ว ผู้ใช้สามารถลงทะเบียนได้' },
		{ value: 'ongoing', label: 'กำลังดำเนินการ', description: 'กิจกรรมกำลังดำเนินการอยู่' },
		{ value: 'completed', label: 'เสร็จสิ้น', description: 'กิจกรรมสิ้นสุดแล้ว' },
		{ value: 'cancelled', label: 'ยกเลิก', description: 'กิจกรรมถูกยกเลิก' }
	];

	// ─── Submit ────────────────────────────────────────────────────────────────
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!activity) return;
		submitting = true;
		try {
			await activitiesApi.update(activity.id, {
				title: titleValue,
				description: descriptionValue || null,
				location: locationValue,
				status: selectedStatus,
				registration_open: registrationOpen,
				max_participants: maxParticipantsValue ? parseInt(maxParticipantsValue) : null,
				organizer_id: selectedOrganizerId || undefined,
				activity_level: selectedActivityLevel || undefined,
				start_date: startDateValue ? startDateValue.toString() : undefined,
				end_date: endDateValue ? endDateValue.toString() : undefined,
				start_time_only: (startTimeHour && startTimeMinute) ? `${startTimeHour}:${startTimeMinute}:00` : undefined,
				end_time_only: (endTimeHour && endTimeMinute) ? `${endTimeHour}:${endTimeMinute}:00` : undefined,
				eligible_organizations: selectedEligibleValues
			});
			toast.success('แก้ไขกิจกรรมสำเร็จ');
			setTimeout(() => goto(`/admin/activities/${activity!.id}`), 50);
		} catch (err: any) {
			toast.error(err.message || 'เกิดข้อผิดพลาดในการอัปเดต');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{activity ? `แก้ไข${activity.title}` : 'แก้ไขกิจกรรม'} - Trackivity</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

{#if loading}
	<div class="space-y-6">
		<div class="flex items-center gap-4">
			<Skeleton class="h-9 w-20" />
			<Skeleton class="h-8 w-64" />
		</div>
		<Skeleton class="h-96 w-full" />
	</div>
{:else if notFound || !activity}
	<div class="py-12 text-center">
		<h2 class="text-xl font-bold">ไม่พบกิจกรรม</h2>
		<Button variant="outline" class="mt-4" onclick={() => goto('/admin/activities')}>กลับ</Button>
	</div>
{:else}
<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" onclick={() => goto(`/admin/activities/${activity!.id}`)}>
			<IconArrowLeft class="mr-2 size-4" />
			กลับ
		</Button>
		<div class="flex-1">
			<h1 class="admin-page-title"><IconCalendar class="size-6 text-primary" /> แก้ไขกิจกรรม</h1>
			<p class="text-muted-foreground">{activity.title}</p>
		</div>
		<Button variant="outline" size="sm" onclick={() => goto(`/admin/activities/${activity!.id}`)}>
			<IconEye class="mr-2 size-4" />
			ดูตัวอย่าง
		</Button>
	</div>

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
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Title -->
				<div class="space-y-2">
					<Label for="title">ชื่อกิจกรรม *</Label>
					<Input
						id="title"
						name="title"
						type="text"
						required
						placeholder="ชื่อกิจกรรม"
						bind:value={titleValue}
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
						bind:value={descriptionValue}
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
						bind:value={locationValue}
						class="text-base"
					/>
				</div>

				<!-- Organizer -->
				<div class="space-y-2">
					<Label for="organizer_id">หน่วยงานผู้จัด *</Label>
					<Select.Root type="single" bind:value={selectedOrganizerId as any}>
						<Select.Trigger>
							{facultyOptions.find((o) => o.value === selectedOrganizerId)?.label || 'เลือกหน่วยงานผู้จัด'}
						</Select.Trigger>
						<Select.Content>
							{#each facultyOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Activity Level -->
				<div class="space-y-2">
					<Label>ระดับกิจกรรม</Label>
					<Select.Root type="single" bind:value={selectedActivityLevel as any}>
						<Select.Trigger>
							{activityLevelOptions?.find((o: any) => o.value === selectedActivityLevel)?.label || selectedActivityLevel || 'เลือกระดับกิจกรรม'}
						</Select.Trigger>
						<Select.Content>
							{#each (activityLevelOptions || []) as option}
								<Select.Item value={(option as any).value}>{(option as any).label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Dates -->
				<div class="grid gap-4 md:grid-cols-2">
					<!-- Start Date -->
					<div class="space-y-2">
						<Label>วันที่เริ่มต้น *</Label>
						<Popover.Root>
							<Popover.Trigger
								class={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start text-left font-normal')}
							>
								<IconCalendar class="mr-2 size-4" />
								{formatDateLabel(startDateValue)}
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0" align="start">
								<Calendar
									locale="th-TH"
									type="single"
									bind:value={startDateValue}
									calendarLabel="วันที่เริ่มต้น"
								/>
							</Popover.Content>
						</Popover.Root>
					</div>

					<!-- End Date -->
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
								<Calendar
									locale="th-TH"
									type="single"
									bind:value={endDateValue}
									calendarLabel="วันที่สิ้นสุด"
								/>
							</Popover.Content>
						</Popover.Root>
					</div>
				</div>

				<!-- Times -->
				<div class="grid gap-4 md:grid-cols-2">
					<!-- Start Time -->
					<div class="space-y-2">
						<Label class="flex items-center gap-2">
							<IconClock class="size-4" />เวลาเริ่มงาน *
						</Label>
						<div class="flex gap-2">
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
							<span class="flex items-center">:</span>
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
					</div>

					<!-- End Time -->
					<div class="space-y-2">
						<Label class="flex items-center gap-2">
							<IconClock class="size-4" />เวลาสิ้นสุด *
						</Label>
						<div class="flex gap-2">
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
							<span class="flex items-center">:</span>
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
					</div>
				</div>

				<!-- Eligible Orgs (Multi-select) -->
				<div class="space-y-2">
					<Label>หน่วยงานที่เข้าร่วมได้ (เลือกได้หลายหน่วยงาน)</Label>
					<Select.Root
						type="multiple"
						bind:value={selectedEligibleValues as any}
					>
						<Select.Trigger>
							{selectedEligibleValues.length > 0
								? `เลือกแล้ว ${selectedEligibleValues.length} หน่วยงาน`
								: 'เลือกหน่วยงานที่เข้าร่วมได้'}
						</Select.Trigger>
						<Select.Content class="max-h-64 overflow-y-auto">
							{#each facultyOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if selectedEligible.length > 0}
						<div class="flex flex-wrap gap-1 pt-1">
							{#each selectedEligible as org}
								<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
									{org.label}
									<button
										type="button"
										onclick={() => selectedEligibleValues = selectedEligibleValues.filter((v) => v !== org.value)}
										class="ml-1 text-muted-foreground hover:text-foreground"
									>×</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Max Participants -->
				<div class="space-y-2">
					<Label for="max_participants">จำนวนผู้เข้าร่วมสูงสุด (ว่างไว้ = ไม่จำกัด)</Label>
					<Input
						id="max_participants"
						name="max_participants"
						type="number"
						min={currentParticipants || 0}
						placeholder="ไม่จำกัด"
						bind:value={maxParticipantsValue}
					/>
					{#if currentParticipants > 0}
						<p class="text-xs text-muted-foreground">ผู้ลงทะเบียนปัจจุบัน: {currentParticipants} คน</p>
					{/if}
				</div>

				<!-- Status -->
				<div class="space-y-2">
					<Label>สถานะกิจกรรม *</Label>
					<Select.Root type="single" bind:value={selectedStatus as any}>
						<Select.Trigger>
							{statusOptions.find((s) => s.value === selectedStatus)?.label || 'เลือกสถานะ'}
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
						{@const opt = statusOptions.find((s) => s.value === selectedStatus)}
						{#if opt}
							<p class="text-sm text-muted-foreground">{opt.description}</p>
						{/if}
					{/if}
				</div>

				<!-- Registration Open toggle -->
				<div class="flex items-center gap-3">
					<Switch bind:checked={registrationOpen} />
					<Label>เปิดให้นักศึกษาลงทะเบียน (ใช้ได้เฉพาะสถานะ "เผยแพร่แล้ว")</Label>
				</div>

				<!-- Read-only info -->
				<div class="grid gap-4 md:grid-cols-2">
					{#if (activity as any).activity_type}
						<div>
							<Label>ประเภทกิจกรรม</Label>
							<p class="text-sm text-muted-foreground">{getActivityTypeDisplayName((activity as any).activity_type)}</p>
						</div>
					{/if}
					{#if (activity as any).academic_year}
						<div>
							<Label>ปีการศึกษา</Label>
							<p class="text-sm text-muted-foreground">{(activity as any).academic_year}</p>
						</div>
					{/if}
					{#if activity.hours}
						<div>
							<Label>ชั่วโมงกิจกรรม</Label>
							<p class="text-sm text-muted-foreground">{activity.hours}</p>
						</div>
					{/if}
				</div>

				<!-- Admin tips -->
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

				<!-- Action Buttons -->
				<div class="flex flex-col gap-4 pt-4 sm:flex-row">
					<Button type="submit" disabled={submitting} class="flex-1 sm:flex-none">
						<IconDeviceFloppy class="mr-2 size-4" />
						{submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
					</Button>
					<Button type="button" variant="outline" onclick={() => goto(`/admin/activities/${activity!.id}`)} disabled={submitting}>
						ยกเลิก
					</Button>
					<Button type="button" variant="ghost" onclick={() => goto('/admin/activities')} disabled={submitting}>
						กลับสู่รายการกิจกรรม
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>

	<!-- Current Info -->
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
						{#if activity.max_participants}/ {activity.max_participants}{/if}
						คน
					</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">สร้างโดย</p>
					<p>{(activity as any).created_by_name || (activity as any).creator_name || '-'}</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">สร้างเมื่อ</p>
					<p>{new Date(activity.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
				</div>
				<div>
					<p class="font-medium text-muted-foreground">แก้ไขล่าสุด</p>
					<p>{new Date(activity.updated_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
{/if}
