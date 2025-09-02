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
	import { Switch } from '$lib/components/ui/switch';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconAlertCircle,
		IconInfoCircle,
		IconEye
	} from '@tabler/icons-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

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
	let selectedFaculty = $state(activity.faculty_id || '');
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
	import { activityLevelOptions, getActivityLevelDisplayName } from '$lib/utils/activity';

	// Activity level selection state - convert display value to storage value
	let selectedActivityLevel = $state((form as any)?.formData?.activity_level || activity.activity_level || 'faculty');

	// Initial selected values from server
	let selectedEligibleValues = $state<string[]>(data.eligible_organizations_selected || []);
	let selectedEligible = $derived(
		selectedEligibleValues.map((id: string) => {
			const opt = facultyOptions.find((o) => o.value === id);
			return { value: id, label: opt?.label || id };
		})
	);

	// Format datetime for input fields
	function formatDateTimeForInput(dateString: string): string {
		const date = new Date(dateString);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		return `${year}-${month}-${day}T${hours}:${minutes}`;
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
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="start_time">วันที่และเวลาเริ่ม *</Label>
						<Input
							id="start_time"
							name="start_time"
							type="datetime-local"
							required
							value={form?.formData?.start_time || formatDateTimeForInput(activity.start_time)}
							class="text-sm"
						/>
					</div>

					<div class="space-y-2">
						<Label for="end_time">วันที่และเวลาสิ้นสุด *</Label>
						<Input
							id="end_time"
							name="end_time"
							type="datetime-local"
							required
							value={form?.formData?.end_time || formatDateTimeForInput(activity.end_time)}
							class="text-sm"
						/>
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
											{#if selectedEligible.some((f) => f.value === option.value)}
												<div class="h-3 w-3 rounded-sm bg-blue-600"></div>
											{:else}
												<div class="h-3 w-3 rounded-sm border border-gray-300"></div>
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
