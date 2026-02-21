<script lang="ts">
	import { activities as activitiesApi, organizations as orgsApi, type Organization } from '$lib/api';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import {
		IconArrowLeft,
		IconCalendar,
		IconClock,
		IconMapPin,
		IconUsers,
		IconPlus
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	// Form state
	let form = $state({
		title: '',
		description: '',
		start_date: '',
		end_date: '',
		start_time: '',
		end_time: '',
		activity_type: 'academic',
		location: '',
		max_participants: '',
		hours: '',
		organizer_id: ''
	});

	let submitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let orgs = $state<Organization[]>([]);

	onMount(async () => {
		try {
			const data = await orgsApi.list();
			orgs = data.all;
		} catch {
			// ignore
		}
	});

	const activityTypeOptions = [
		{ value: 'academic', label: 'วิชาการ' },
		{ value: 'sports', label: 'กีฬา' },
		{ value: 'cultural', label: 'วัฒนธรรม' },
		{ value: 'social', label: 'สังคม' },
		{ value: 'other', label: 'อื่นๆ' }
	];

	function validate() {
		const e: Record<string, string> = {};
		if (!form.title.trim()) e.title = 'กรุณากรอกชื่อกิจกรรม';
		if (!form.start_date) e.start_date = 'กรุณาเลือกวันที่เริ่ม';
		if (!form.end_date) e.end_date = 'กรุณาเลือกวันที่สิ้นสุด';
		if (!form.start_time) e.start_time = 'กรุณากรอกเวลาเริ่ม';
		if (!form.end_time) e.end_time = 'กรุณากรอกเวลาสิ้นสุด';
		if (!form.location.trim()) e.location = 'กรุณากรอกสถานที่';
		if (!form.hours || Number(form.hours) <= 0) e.hours = 'กรุณากรอกชั่วโมงกิจกรรม';
		if (!form.activity_type) e.activity_type = 'กรุณาเลือกประเภทกิจกรรม';
		if (!form.organizer_id) e.organizer_id = 'กรุณาเลือกหน่วยงานที่จัดกิจกรรม';
		if (form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date)) {
			e.end_date = 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น';
		}
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || submitting) return;
		submitting = true;
		try {
			await activitiesApi.create({
				title: form.title,
				description: form.description || null,
				start_date: form.start_date,
				end_date: form.end_date,
				start_time_only: form.start_time ? `${form.start_time}:00` : null,
				end_time_only: form.end_time ? `${form.end_time}:00` : null,
				activity_type: form.activity_type,
				location: form.location,
				max_participants: form.max_participants ? Number(form.max_participants) : null,
				hours: Number(form.hours),
				organizer_id: form.organizer_id
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
		<Card>
			<CardHeader>
				<CardTitle>ข้อมูลพื้นฐาน</CardTitle>
				<CardDescription>รายละเอียดของกิจกรรม</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-2">
					<Label for="title">ชื่อกิจกรรม *</Label>
					<Input id="title" bind:value={form.title} placeholder="กรอกชื่อกิจกรรม" />
					{#if errors.title}
						<p class="text-sm text-red-500">{errors.title}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="description">รายละเอียด</Label>
					<Textarea id="description" bind:value={form.description} placeholder="รายละเอียดกิจกรรม (ไม่บังคับ)" rows={4} />
				</div>

				<div class="space-y-2">
					<Label for="activity_type">ประเภทกิจกรรม *</Label>
					<Select.Root type="single" bind:value={form.activity_type}>
						<Select.Trigger class="w-full">
							{activityTypeOptions.find((o) => o.value === form.activity_type)?.label || 'เลือกประเภทกิจกรรม'}
						</Select.Trigger>
						<Select.Content>
							{#each activityTypeOptions as opt}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if errors.activity_type}
						<p class="text-sm text-red-500">{errors.activity_type}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="organizer_id">หน่วยงานที่จัดกิจกรรม *</Label>
					<Select.Root type="single" bind:value={form.organizer_id}>
						<Select.Trigger class="w-full">
							{orgs.find((o) => o.id === form.organizer_id)?.name || 'เลือกหน่วยงาน'}
						</Select.Trigger>
						<Select.Content>
							{#each orgs as org}
								<Select.Item value={org.id}>{org.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if errors.organizer_id}
						<p class="text-sm text-red-500">{errors.organizer_id}</p>
					{/if}
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconClock class="size-5" />วันที่และเวลา
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="start_date">วันที่เริ่ม *</Label>
						<Input id="start_date" type="date" bind:value={form.start_date} />
						{#if errors.start_date}
							<p class="text-sm text-red-500">{errors.start_date}</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label for="start_time">เวลาเริ่ม *</Label>
						<Input id="start_time" type="time" bind:value={form.start_time} />
						{#if errors.start_time}
							<p class="text-sm text-red-500">{errors.start_time}</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label for="end_date">วันที่สิ้นสุด *</Label>
						<Input id="end_date" type="date" bind:value={form.end_date} />
						{#if errors.end_date}
							<p class="text-sm text-red-500">{errors.end_date}</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label for="end_time">เวลาสิ้นสุด *</Label>
						<Input id="end_time" type="time" bind:value={form.end_time} />
						{#if errors.end_time}
							<p class="text-sm text-red-500">{errors.end_time}</p>
						{/if}
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconMapPin class="size-5" />สถานที่และผู้เข้าร่วม
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-2">
					<Label for="location">สถานที่จัดกิจกรรม *</Label>
					<Input id="location" bind:value={form.location} placeholder="ระบุสถานที่จัดกิจกรรม" />
					{#if errors.location}
						<p class="text-sm text-red-500">{errors.location}</p>
					{/if}
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="hours">ชั่วโมงกิจกรรม *</Label>
						<Input id="hours" type="number" min="1" bind:value={form.hours} placeholder="จำนวนชั่วโมง" />
						{#if errors.hours}
							<p class="text-sm text-red-500">{errors.hours}</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label for="max_participants">จำนวนที่รับได้สูงสุด</Label>
						<Input id="max_participants" type="number" min="1" bind:value={form.max_participants} placeholder="ไม่จำกัด (ถ้าเว้นว่าง)" />
					</div>
				</div>
			</CardContent>
		</Card>

		<div class="flex gap-4">
			<Button type="submit" disabled={submitting} class="flex items-center gap-2">
				<IconPlus class="size-4" />
				{submitting ? 'กำลังสร้าง...' : 'สร้างกิจกรรม'}
			</Button>
			<Button type="button" variant="outline" onclick={() => goto('/admin/activities')}>ยกเลิก</Button>
		</div>
	</form>
</div>
