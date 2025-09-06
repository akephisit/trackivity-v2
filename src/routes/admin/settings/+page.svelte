<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import {
		IconSettings,
		IconHourglass,
		IconSchool,
		IconBuilding,
		IconCheck,
		IconAlertCircle,
		IconInfoCircle
	} from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';

	let { data, form } = $props();
	
	let isSubmitting = $state(false);
	let requiredFacultyHours = $state(data.currentRequirements.requiredFacultyHours);
	let requiredUniversityHours = $state(data.currentRequirements.requiredUniversityHours);

	function handleSubmit() {
		isSubmitting = true;
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				toast.success(result.data?.message || 'การตั้งค่าได้รับการอัพเดทเรียบร้อยแล้ว');
			} else if (result.type === 'failure') {
				toast.error(result.data?.error || 'เกิดข้อผิดพลาดในการอัพเดท');
			}
			isSubmitting = false;
			await update();
		};
	}
</script>

<svelte:head>
	<title>ตั้งค่าระบบ - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1 min-w-0">
			<h1 class="admin-page-title"><IconSettings class="size-6 text-primary" /> ตั้งค่าระบบ</h1>
			<p class="text-muted-foreground">จัดการการตั้งค่าองค์กรและระบบกิจกรรม</p>
		</div>
	</div>

	<!-- Organization Info -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconBuilding class="h-5 w-5" />
				ข้อมูลองค์กร
			</CardTitle>
			<CardDescription>ข้อมูลพื้นฐานขององค์กร</CardDescription>
		</CardHeader>
		<CardContent class="p-4 lg:p-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label class="text-sm font-medium">ชื่อองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">{data.organization.name}</p>
				</div>
				<div>
					<Label class="text-sm font-medium">รหัสองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">{data.organization.code}</p>
				</div>
				<div>
					<Label class="text-sm font-medium">ประเภทองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">
						{data.organization.organizationType === 'faculty' ? 'คณะ' : 'หน่วยงาน'}
					</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Activity Hours Requirements -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconHourglass class="h-5 w-5" />
				การตั้งค่าจำนวนชั่วโมงสะสมการผ่านกิจกรรม
			</CardTitle>
			<CardDescription>
				กำหนดจำนวนชั่วโมงขั้นต่ำที่นักศึกษาต้องสะสมจากการเข้าร่วมกิจกรรมตลอดการศึกษา
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4 lg:space-y-6 p-4 lg:p-6">
			<!-- Info Alert -->
			<Alert>
				<IconInfoCircle class="size-4" />
				<AlertDescription>
					การตั้งค่านี้จะใช้สำหรับคำนวณความก้าวหน้าของนักศึกษาในการสะสมชั่วโมงกิจกรรมตลอดการศึกษา 
					และแสดงผลใน Progress Bar ในหน้าสรุปกิจกรรมของนักศึกษา
				</AlertDescription>
			</Alert>

			<!-- Current Settings Display -->
			<div class="rounded-lg border bg-muted/30 p-4">
				<h4 class="mb-3 font-semibold">การตั้งค่าปัจจุบัน</h4>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-green-100 p-2">
							<IconSchool class="h-4 w-4 text-green-600" />
						</div>
						<div>
							<p class="text-sm font-medium">กิจกรรมระดับคณะ</p>
							<p class="text-lg font-bold text-green-600">
								{data.currentRequirements.requiredFacultyHours} ชั่วโมง
							</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100 p-2">
							<IconBuilding class="h-4 w-4 text-blue-600" />
						</div>
						<div>
							<p class="text-sm font-medium">กิจกรรมระดับมหาวิทยาลัย</p>
							<p class="text-lg font-bold text-blue-600">
								{data.currentRequirements.requiredUniversityHours} ชั่วโมง
							</p>
						</div>
					</div>
				</div>
			</div>

			<Separator />

			<!-- Settings Form -->
			<form method="POST" action="?/updateRequirements" use:enhance={handleSubmit}>
				<div class="space-y-6">
					<div class="grid gap-6 sm:grid-cols-2">
						<!-- Faculty Hours -->
						<div class="space-y-2">
							<Label for="requiredFacultyHours" class="flex items-center gap-2">
								<IconSchool class="h-4 w-4 text-green-600" />
								จำนวนชั่วโมงขั้นต่ำ - กิจกรรมระดับคณะ
							</Label>
							<Input
								id="requiredFacultyHours"
								name="requiredFacultyHours"
								type="number"
								min="0"
								max="1000"
								bind:value={requiredFacultyHours}
								placeholder="กรอกจำนวนชั่วโมง"
								required
							/>
							<p class="text-xs text-muted-foreground">
								นักศึกษาต้องสะสมชั่วโมงจากกิจกรรมระดับคณะอย่างน้อย {requiredFacultyHours} ชั่วโมง
							</p>
						</div>

						<!-- University Hours -->
						<div class="space-y-2">
							<Label for="requiredUniversityHours" class="flex items-center gap-2">
								<IconBuilding class="h-4 w-4 text-blue-600" />
								จำนวนชั่วโมงขั้นต่ำ - กิจกรรมระดับมหาวิทยาลัย
							</Label>
							<Input
								id="requiredUniversityHours"
								name="requiredUniversityHours"
								type="number"
								min="0"
								max="1000"
								bind:value={requiredUniversityHours}
								placeholder="กรอกจำนวนชั่วโมง"
								required
							/>
							<p class="text-xs text-muted-foreground">
								นักศึกษาต้องสะสมชั่วโมงจากกิจกรรมระดับมหาวิทยาลัยอย่างน้อย {requiredUniversityHours} ชั่วโมง
							</p>
						</div>
					</div>


					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3">
						<Button type="submit" disabled={isSubmitting} class="gap-2 w-full sm:w-auto">
							{#if isSubmitting}
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
							{:else}
								<IconCheck class="h-4 w-4" />
							{/if}
							{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
						</Button>
						<Button
							type="button"
							variant="outline"
							onclick={() => {
								requiredFacultyHours = data.currentRequirements.requiredFacultyHours;
								requiredUniversityHours = data.currentRequirements.requiredUniversityHours;
							}}
						>
							รีเซ็ต
						</Button>
					</div>

					<!-- Total Hours Info -->
					<div class="rounded-lg bg-blue-50 p-4">
						<div class="flex items-center gap-2 text-blue-700">
							<IconInfoCircle class="h-4 w-4" />
							<p class="text-sm font-medium">ข้อมูลสรุป</p>
						</div>
						<p class="mt-2 text-sm text-blue-600">
							นักศึกษาจะต้องสะสมชั่วโมงกิจกรรมรวมทั้งหมดอย่างน้อย 
							<span class="font-semibold">{requiredFacultyHours + requiredUniversityHours} ชั่วโมง</span>
							ตลอดการศึกษาเพื่อผ่านเกณฑ์การสำเร็จการศึกษา
						</p>
					</div>
				</div>
			</form>

			<!-- Form Messages -->
			{#if form?.success}
				<Alert>
					<IconCheck class="h-4 w-4" />
					<AlertDescription class="text-green-700">
						{form.message}
					</AlertDescription>
				</Alert>
			{/if}

			{#if form?.error}
				<Alert variant="destructive">
					<IconAlertCircle class="h-4 w-4" />
					<AlertDescription>
						{form.error}
					</AlertDescription>
				</Alert>
			{/if}
		</CardContent>
	</Card>
</div>
