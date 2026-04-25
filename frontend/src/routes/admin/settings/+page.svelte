<script lang="ts">
	import { CircleAlert, Building as BuildingIcon, Check, Hourglass, Info, RefreshCw, School, Settings } from '@lucide/svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from 'svelte-sonner';
	import { authStore } from '$lib/stores/auth.svelte';
	import { organizationsApi, type Organization } from '$lib/api';
	import { onMount } from 'svelte';

	// CSR state — org info from authStore
	const user = $derived(authStore.user);
	let organization = $state<Organization | null>(null);
	let isLoadingOrg = $state(true);
	let loadError = $state<string | null>(null);

	let isSubmitting = $state(false);
	// Form values; null until loaded so we don't display fake defaults.
	let requiredFacultyHours = $state<number | null>(null);
	let requiredUniversityHours = $state<number | null>(null);
	// Original values from the server, used by the reset button so it
	// reverts to the last saved values instead of hard-coded 6/12.
	let initialFacultyHours = $state<number | null>(null);
	let initialUniversityHours = $state<number | null>(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!organization || requiredFacultyHours === null || requiredUniversityHours === null) return;
		isSubmitting = true;

		try {
			await organizationsApi.updateRequirements(organization.id, {
				required_faculty_hours: requiredFacultyHours,
				required_university_hours: requiredUniversityHours
			});
			initialFacultyHours = requiredFacultyHours;
			initialUniversityHours = requiredUniversityHours;
			toast.success('การตั้งค่าได้รับการอัพเดทเรียบร้อยแล้ว');
		} catch (err: any) {
			toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
		} finally {
			isSubmitting = false;
		}
	}

	function resetToInitial() {
		requiredFacultyHours = initialFacultyHours;
		requiredUniversityHours = initialUniversityHours;
	}

	async function fetchSettings() {
		const orgId = user?.admin_role?.organization_id;
		if (!orgId) {
			isLoadingOrg = false;
			return;
		}
		isLoadingOrg = true;
		loadError = null;
		try {
			// Fetch org metadata and per-org requirements in parallel.
			// list() returns all orgs (the existing API doesn't expose a
			// single-org GET); we tolerate that for now and just pick ours.
			const [orgList, reqs] = await Promise.all([
				organizationsApi.list(),
				organizationsApi.getRequirements(orgId)
			]);
			organization = orgList.all.find((o) => o.id === orgId) || null;
			requiredFacultyHours = reqs.required_faculty_hours;
			requiredUniversityHours = reqs.required_university_hours;
			initialFacultyHours = reqs.required_faculty_hours;
			initialUniversityHours = reqs.required_university_hours;
		} catch (e: any) {
			loadError = e?.message ?? 'ไม่สามารถโหลดการตั้งค่าได้';
			console.error('Failed to load organization settings', e);
		} finally {
			isLoadingOrg = false;
		}
	}

	onMount(fetchSettings);

	const totalHours = $derived(
		(requiredFacultyHours ?? 0) + (requiredUniversityHours ?? 0)
	);
	const isDirty = $derived(
		requiredFacultyHours !== initialFacultyHours ||
			requiredUniversityHours !== initialUniversityHours
	);
</script>

<svelte:head>
	<title>ตั้งค่าระบบ - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0 space-y-1">
			<h1 class="admin-page-title"><Settings class="size-6 text-primary" /> ตั้งค่าระบบ</h1>
			<p class="text-muted-foreground">จัดการการตั้งค่าองค์กรและระบบกิจกรรม</p>
		</div>
	</div>

	<!-- Organization Info -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<BuildingIcon class="h-5 w-5" />
				ข้อมูลองค์กร
			</CardTitle>
			<CardDescription>ข้อมูลพื้นฐานขององค์กร</CardDescription>
		</CardHeader>
		<CardContent class="p-4 lg:p-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label class="text-sm font-medium">ชื่อองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if isLoadingOrg}กำลังโหลด...{:else}{organization?.name ||
								user?.organization_name ||
								'-'}{/if}
					</p>
				</div>
				<div>
					<Label class="text-sm font-medium">รหัสองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if isLoadingOrg}กำลังโหลด...{:else}{organization?.code || '-'}{/if}
					</p>
				</div>
				<div>
					<Label class="text-sm font-medium">ประเภทองค์กร</Label>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if isLoadingOrg}กำลังโหลด...{:else}{organization?.organization_type === 'faculty'
								? 'คณะ (Faculty)'
								: organization?.organization_type === 'office'
									? 'หน่วยงาน (Office)'
									: 'หน่วยงาน'}{/if}
					</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Activity Hours Requirements -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Hourglass class="h-5 w-5" />
				การตั้งค่าจำนวนชั่วโมงสะสมการผ่านกิจกรรม
			</CardTitle>
			<CardDescription>
				กำหนดจำนวนชั่วโมงขั้นต่ำที่นักศึกษาต้องสะสมจากการเข้าร่วมกิจกรรมตลอดการศึกษา
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4 p-4 lg:space-y-6 lg:p-6">
			<!-- Info Alert -->
			<Alert>
				<Info class="size-4" />
				<AlertDescription>
					การตั้งค่านี้จะใช้สำหรับคำนวณความก้าวหน้าของนักศึกษาในการสะสมชั่วโมงกิจกรรมตลอดการศึกษา
					และแสดงผลใน Progress Bar ในหน้าสรุปกิจกรรมของนักศึกษา
				</AlertDescription>
			</Alert>

			{#if loadError}
				<Alert variant="destructive">
					<CircleAlert class="size-4" />
					<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<span>{loadError}</span>
						<Button size="sm" variant="outline" onclick={fetchSettings}>
							<RefreshCw class="mr-2 size-4" />ลองใหม่
						</Button>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Current Settings Display -->
			<div class="rounded-lg border bg-muted/30 p-4">
				<h4 class="mb-3 font-semibold">การตั้งค่าปัจจุบัน</h4>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
							<School class="h-4 w-4 text-green-600 dark:text-green-400" />
						</div>
						<div>
							<p class="text-sm font-medium">กิจกรรมระดับคณะ</p>
							{#if isLoadingOrg}
								<Skeleton class="mt-1 h-6 w-24" />
							{:else}
								<p class="text-lg font-bold text-green-600 dark:text-green-400">
									{initialFacultyHours ?? '-'} ชั่วโมง
								</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
							<BuildingIcon class="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<p class="text-sm font-medium">กิจกรรมระดับมหาวิทยาลัย</p>
							{#if isLoadingOrg}
								<Skeleton class="mt-1 h-6 w-24" />
							{:else}
								<p class="text-lg font-bold text-blue-600 dark:text-blue-400">
									{initialUniversityHours ?? '-'} ชั่วโมง
								</p>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<Separator />

			<!-- Settings Form -->
			<form onsubmit={handleSubmit}>
				<div class="space-y-6">
					<div class="grid gap-6 sm:grid-cols-2">
						<!-- Faculty Hours -->
						<div class="space-y-2">
							<Label for="requiredFacultyHours" class="flex items-center gap-2">
								<School class="h-4 w-4 text-green-600 dark:text-green-400" />
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
								disabled={isLoadingOrg || isSubmitting}
								required
							/>
							<p class="text-xs text-muted-foreground">
								นักศึกษาต้องสะสมชั่วโมงจากกิจกรรมระดับคณะอย่างน้อย {requiredFacultyHours ?? 0} ชั่วโมง
							</p>
						</div>

						<!-- University Hours -->
						<div class="space-y-2">
							<Label for="requiredUniversityHours" class="flex items-center gap-2">
								<BuildingIcon class="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
								disabled={isLoadingOrg || isSubmitting}
								required
							/>
							<p class="text-xs text-muted-foreground">
								นักศึกษาต้องสะสมชั่วโมงจากกิจกรรมระดับมหาวิทยาลัยอย่างน้อย {requiredUniversityHours ?? 0}
								ชั่วโมง
							</p>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col gap-3 sm:flex-row">
						<Button
							type="submit"
							disabled={isSubmitting || isLoadingOrg || !isDirty}
							class="w-full gap-2 sm:w-auto"
						>
							{#if isSubmitting}
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								></div>
							{:else}
								<Check class="h-4 w-4" />
							{/if}
							{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
						</Button>
						<Button
							type="button"
							variant="outline"
							onclick={resetToInitial}
							disabled={isLoadingOrg || isSubmitting || !isDirty}
						>
							ย้อนกลับเป็นค่าเดิม
						</Button>
					</div>

					<!-- Total Hours Info -->
					<div class="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
						<div class="flex items-center gap-2 text-blue-700 dark:text-blue-300">
							<Info class="h-4 w-4" />
							<p class="text-sm font-medium">ข้อมูลสรุป</p>
						</div>
						<p class="mt-2 text-sm text-blue-600 dark:text-blue-400">
							นักศึกษาจะต้องสะสมชั่วโมงกิจกรรมรวมทั้งหมดอย่างน้อย
							<span class="font-semibold">{totalHours} ชั่วโมง</span>
							ตลอดการศึกษาเพื่อผ่านเกณฑ์การสำเร็จการศึกษา
						</p>
					</div>
				</div>
			</form>
		</CardContent>
	</Card>
</div>
