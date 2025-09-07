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
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import * as Select from '$lib/components/ui/select';
	import {
		IconLoader,
		IconPlus,
		IconEdit,
		IconTrash,
		IconSchool,
		IconToggleLeft,
		IconToggleRight,
		IconUsers,
		IconBuilding,
		IconSearch,
		IconFilter
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll, invalidate } from '$app/navigation';

	let { data } = $props();
	let refreshing = $state(false);

	// Search and filter states
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'active' | 'inactive'>('all');

	// Filtered faculties
	let filteredFaculties = $derived.by(() => {
		let filtered = data.faculties;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(faculty: any) =>
					faculty.name.toLowerCase().includes(query) ||
					faculty.code.toLowerCase().includes(query) ||
					(faculty.description && faculty.description.toLowerCase().includes(query))
			);
		}

		// Apply status filter
		if (statusFilter !== 'all') {
			filtered = filtered.filter((faculty: any) =>
				statusFilter === 'active' ? faculty.status : !faculty.status
			);
		}

		return filtered;
	});

	function clearSearch() {
		searchQuery = '';
	}

	// Faculty schemas
	const facultyCreateSchema = z.object({
		name: z.string().min(1, 'กรุณากรอกชื่อหน่วยงาน'),
		code: z.string().min(1, 'กรุณากรอกรหัสหน่วยงาน').max(10, 'รหัสหน่วยงานต้องไม่เกิน 10 ตัวอักษร'),
		description: z.string().optional(),
		organizationType: z.enum(['faculty', 'office']).default('faculty'),
		status: z.boolean().default(true)
	});

	// Forms
	const createForm = superForm(data.createForm, {
		validators: zodClient(facultyCreateSchema),
		onResult: async ({ result }) => {
			if (result.type === 'success') {
				toast.success('สร้างหน่วยงานสำเร็จ');
				createDialogOpen = false;

				setTimeout(async () => {
					try {
						refreshing = true;
						await invalidate('app:page-data');
						await invalidateAll();
						refreshing = false;
					} catch (error) {
						console.error('Failed to refresh data:', error);
						refreshing = false;
						window.location.reload();
					}
				}, 500);
			} else if (result.type === 'failure') {
				toast.error('เกิดข้อผิดพลาดในการสร้างหน่วยงาน');
			}
		}
	});

	const {
		form: createFormData,
		enhance: createEnhance,
		errors: createErrors,
		submitting: createSubmitting
	} = createForm;

	// Dialog states
	let createDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);

	// Edit form states
	let editingFaculty = $state<any>(null);
	let editFormData = $state({
		name: '',
		code: '',
		description: '',
		organizationType: 'faculty' as 'faculty' | 'office',
		status: true
	});

	// Delete state
	let facultyToDelete = $state<{ id: string; name: string } | null>(null);

	// Toggle loading
	let toggleLoading = $state<{ [key: string]: boolean }>({});

	// Stats
	let stats = $derived({
		total: data.faculties.length,
		active: data.faculties.filter((f: any) => f.status).length,
		inactive: data.faculties.filter((f: any) => !f.status).length
	});

	function openCreateDialog() {
		$createFormData = {
			name: '',
			code: '',
			description: '',
			organizationType: 'faculty',
			status: true
		};
		createDialogOpen = true;
	}

	function openEditDialog(faculty: any) {
		editingFaculty = faculty;
		editFormData = {
			name: faculty.name,
			code: faculty.code,
			description: faculty.description || '',
			organizationType: faculty.organizationType || 'faculty',
			status: faculty.status
		};
		editDialogOpen = true;
	}

	function openDeleteDialog(facultyId: string, facultyName: string) {
		facultyToDelete = { id: facultyId, name: facultyName };
		deleteDialogOpen = true;
	}

	async function handleUpdate() {
		if (!editingFaculty) return;

		try {
			const formData = new FormData();
			formData.append('facultyId', editingFaculty.id);
			formData.append('updateData', JSON.stringify(editFormData));

			const response = await fetch('?/update', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('แก้ไขหน่วยงานสำเร็จ');
				editDialogOpen = false;
				setTimeout(async () => {
					try {
						await invalidate('app:page-data');
						await invalidateAll();
					} catch (error) {
						console.error('Failed to refresh data after update:', error);
						window.location.reload();
					}
				}, 500);
			} else {
				toast.error('เกิดข้อผิดพลาดในการแก้ไขหน่วยงาน');
			}
		} catch (error) {
			console.error('Update error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	async function handleDelete() {
		if (!facultyToDelete) return;

		try {
			const formData = new FormData();
			formData.append('facultyId', facultyToDelete.id);

			const response = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('ลบหน่วยงานสำเร็จ');
				deleteDialogOpen = false;
				facultyToDelete = null;
				setTimeout(async () => {
					try {
						await invalidate('app:page-data');
						await invalidateAll();
					} catch (error) {
						console.error('Failed to refresh data after delete:', error);
						window.location.reload();
					}
				}, 500);
			} else {
				toast.error('เกิดข้อผิดพลาดในการลบหน่วยงาน');
			}
		} catch (error) {
			console.error('Delete error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	async function handleToggleStatus(facultyId: string, currentStatus: boolean) {
		const newStatus = !currentStatus;
		const actionText = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

		toggleLoading = { ...toggleLoading, [facultyId]: true };

		try {
			const formData = new FormData();
			formData.append('facultyId', facultyId);

			const response = await fetch('?/toggleStatus', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(`${actionText}หน่วยงานสำเร็จ`);
				setTimeout(async () => {
					try {
						await invalidate('app:page-data');
						await invalidateAll();
					} catch (error) {
						console.error('Failed to refresh data after toggle status:', error);
						window.location.reload();
					}
				}, 300);
			} else {
				toast.error(result.error || `เกิดข้อผิดพลาดในการ${actionText}หน่วยงาน`);
			}
		} catch (error) {
			console.error('Toggle status error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			toggleLoading = { ...toggleLoading, [facultyId]: false };
		}
	}

	function formatDateTime(dateInput: string | Date | null | undefined) {
		if (!dateInput) return '-';
		const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
		return d.toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>จัดการหน่วยงาน - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0 space-y-1">
			<h1 class="admin-page-title"><IconBuilding class="size-6 text-primary" /> จัดการหน่วยงาน</h1>
			<p class="text-muted-foreground">
				จัดการข้อมูลหน่วยงานในมหาวิทยาลัย รวมถึงการเปิด-ปิดการใช้งาน
			</p>
		</div>
		<Button onclick={openCreateDialog} class="w-full gap-2 sm:w-auto">
			<IconPlus class="h-4 w-4" />
			เพิ่มหน่วยงานใหม่
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">หน่วยงานทั้งหมด</CardTitle>
				<IconSchool class="h-4 w-4 flex-shrink-0 text-muted-foreground lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold lg:text-2xl">{stats.total}</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">เปิดใช้งาน</CardTitle>
				<IconBuilding class="h-4 w-4 flex-shrink-0 text-green-500 lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold text-green-600 lg:text-2xl">
					{stats.active}
				</div>
			</CardContent>
		</Card>

		<Card class="col-span-2 lg:col-span-1">
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">ปิดใช้งาน</CardTitle>
				<IconUsers class="h-4 w-4 flex-shrink-0 text-red-500 lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold text-red-600 lg:text-2xl">
					{stats.inactive}
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Search and Filter -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<IconFilter class="h-5 w-5" />
				ค้นหาและกรอง
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-4 sm:flex sm:flex-col sm:space-y-0 lg:flex-row lg:gap-4">
				<div class="flex-1">
					<div class="relative">
						<IconSearch
							class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							bind:value={searchQuery}
							placeholder="ค้นหาชื่อหน่วยงาน รหัส หรือคำอธิบาย..."
							class="pl-10"
						/>
					</div>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button
						variant={statusFilter === 'all' ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto"
						onclick={() => (statusFilter = 'all')}
					>
						ทั้งหมด ({stats.total})
					</Button>
					<Button
						variant={statusFilter === 'active' ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto {statusFilter === 'active'
							? ''
							: 'border-green-600 text-green-600 hover:bg-green-50'}"
						onclick={() => (statusFilter = 'active')}
					>
						เปิดใช้งาน ({stats.active})
					</Button>
					<Button
						variant={statusFilter === 'inactive' ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto {statusFilter === 'inactive'
							? ''
							: 'border-red-600 text-red-600 hover:bg-red-50'}"
						onclick={() => (statusFilter = 'inactive')}
					>
						ปิดใช้งาน ({stats.inactive})
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Organizations Table -->
	<div class="space-y-6">
		{#if refreshing}
			<div class="flex items-center justify-center py-12">
				<IconLoader class="mr-3 h-8 w-8 animate-spin text-muted-foreground" />
				<span class="text-muted-foreground">กำลังรีเฟรชข้อมูล...</span>
			</div>
		{:else if filteredFaculties.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				{#if searchQuery || statusFilter !== 'all'}
					<IconSearch class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="mb-2 text-lg font-semibold">ไม่พบข้อมูลที่ตรงกับการค้นหา</h3>
					<p class="mb-4 text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่</p>
					<Button onclick={clearSearch} variant="outline">ล้างการค้นหา</Button>
				{:else}
					<IconSchool class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="mb-2 text-lg font-semibold">ยังไม่มีข้อมูลหน่วยงานในระบบ</h3>
					<p class="mb-4 text-muted-foreground">เริ่มต้นด้วยการเพิ่มหน่วยงานแรก</p>
					<Button onclick={openCreateDialog} class="gap-2">
						<IconPlus class="h-4 w-4" />
						เพิ่มหน่วยงานแรก
					</Button>
				{/if}
			</div>
		{:else}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<IconSchool class="h-5 w-5" />
						รายการหน่วยงาน
						<Badge variant="secondary" class="ml-2">
							{filteredFaculties.length} รายการ
						</Badge>
					</CardTitle>
					<CardDescription>จัดการข้อมูลหน่วยงานต่างๆ ในมหาวิทยาลัย</CardDescription>
				</CardHeader>
				<CardContent class="p-0">
					<div class="overflow-x-auto">
						<Table.Root>
							<Table.Header>
								<Table.Row class="bg-gray-50 dark:bg-gray-800">
									<Table.Head class="font-semibold">ชื่อหน่วยงาน</Table.Head>
									<Table.Head class="font-semibold">รหัส</Table.Head>
									<Table.Head class="font-semibold">ประเภท</Table.Head>
									<Table.Head class="font-semibold">คำอธิบาย</Table.Head>
									<Table.Head class="font-semibold">สถานะ</Table.Head>
									<Table.Head class="font-semibold">วันที่สร้าง</Table.Head>
									<Table.Head class="text-right font-semibold">การดำเนินการ</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each filteredFaculties as faculty (faculty.id)}
									<Table.Row class="hover:bg-muted/50">
										<Table.Cell class="py-4 font-medium">
											<div class="flex min-w-0 items-center gap-3">
												<div
													class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 lg:h-10 lg:w-10"
												>
													<IconSchool class="h-4 w-4 text-blue-600 lg:h-5 lg:w-5" />
												</div>
												<div class="min-w-0 flex-1">
													<div class="truncate font-semibold">
														{faculty.name}
													</div>
												</div>
											</div>
										</Table.Cell>
										<Table.Cell class="py-4">
											<Badge variant="outline" class="font-mono">
												{faculty.code}
											</Badge>
										</Table.Cell>
										<Table.Cell class="py-4">
											<Badge
												variant={faculty.organizationType === 'faculty' ? 'default' : 'secondary'}
												class={faculty.organizationType === 'faculty'
													? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
													: 'bg-purple-100 text-purple-800 hover:bg-purple-100'}
											>
												{faculty.organizationType === 'faculty' ? 'คณะ' : 'หน่วยงาน'}
											</Badge>
										</Table.Cell>
										<Table.Cell class="py-4">
											<div
												class="max-w-48 min-w-0 truncate text-sm text-muted-foreground lg:max-w-xs"
											>
												{faculty.description || '-'}
											</div>
										</Table.Cell>
										<Table.Cell class="py-4">
											<Badge variant={faculty.status ? 'default' : 'secondary'}>
												<span
													class="mr-2 h-2 w-2 rounded-full"
													class:bg-green-500={faculty.status}
													class:bg-gray-400={!faculty.status}
												></span>
												{faculty.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
											</Badge>
										</Table.Cell>
										<Table.Cell class="py-4 text-sm text-muted-foreground">
											{formatDateTime(faculty.created_at)}
										</Table.Cell>
										<Table.Cell class="py-4 text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													onclick={() => handleToggleStatus(faculty.id, faculty.status)}
													disabled={toggleLoading[faculty.id] || false}
													title="{faculty.status ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}หน่วยงาน"
												>
													{#if toggleLoading[faculty.id]}
														<IconLoader class="h-4 w-4 animate-spin" />
													{:else if faculty.status}
														<IconToggleLeft class="h-4 w-4" />
													{:else}
														<IconToggleRight class="h-4 w-4" />
													{/if}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => openEditDialog(faculty)}
													title="แก้ไขหน่วยงาน"
												>
													<IconEdit class="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => openDeleteDialog(faculty.id, faculty.name)}
													title="ลบหน่วยงาน"
												>
													<IconTrash class="h-4 w-4" />
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</CardContent>
			</Card>
		{/if}
	</div>
</div>

<!-- Create Faculty Dialog -->
<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>เพิ่มหน่วยงานใหม่</Dialog.Title>
			<Dialog.Description>กรอกข้อมูลเพื่อสร้างหน่วยงานใหม่ในระบบ</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/create" use:createEnhance class="space-y-4">
			{#if $createErrors._errors}
				<Alert variant="destructive">
					<AlertDescription>
						{$createErrors._errors[0]}
					</AlertDescription>
				</Alert>
			{/if}

			<Form.Field form={createForm} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Label for={props.id}>ชื่อหน่วยงาน</Label>
						<Input
							{...props}
							bind:value={$createFormData.name}
							placeholder="เช่น หน่วยงานวิทยาศาสตร์"
							disabled={$createSubmitting}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field form={createForm} name="code">
				<Form.Control>
					{#snippet children({ props })}
						<Label for={props.id}>รหัสหน่วยงาน</Label>
						<Input
							{...props}
							bind:value={$createFormData.code}
							placeholder="เช่น SCI"
							disabled={$createSubmitting}
							class="font-mono"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field form={createForm} name="description">
				<Form.Control>
					{#snippet children({ props })}
						<Label for={props.id}>คำอธิบาย (ไม่บังคับ)</Label>
						<Textarea
							{...props}
							bind:value={$createFormData.description}
							placeholder="คำอธิบายเพิ่มเติมเกี่ยวกับหน่วยงาน"
							disabled={$createSubmitting}
							rows={3}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field form={createForm} name="organizationType">
				<Form.Control>
					{#snippet children({ props })}
						<Label for={props.id}>ประเภทหน่วยงาน</Label>
						<!-- Hidden input to ensure superforms serializes selected value -->
						<input type="hidden" name={props.name} value={$createFormData.organizationType} />
						<Select.Root
							type="single"
							bind:value={$createFormData.organizationType}
							disabled={$createSubmitting}
						>
							<Select.Trigger class="w-full">
								{$createFormData.organizationType === 'faculty'
									? 'คณะ'
									: $createFormData.organizationType === 'office'
										? 'หน่วยงาน'
										: 'เลือกประเภทหน่วยงาน'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="faculty">คณะ</Select.Item>
								<Select.Item value="office">หน่วยงาน</Select.Item>
							</Select.Content>
						</Select.Root>
						<p class="mt-1 text-sm text-gray-600">
							{$createFormData.organizationType === 'faculty'
								? 'คณะ: สามารถเพิ่มสาขาวิชาได้ และนักเรียนสามารถสมัครได้'
								: 'หน่วยงาน: ไม่สามารถเพิ่มสาขาวิชาได้ และนักเรียนไม่สามารถสมัครได้'}
						</p>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field form={createForm} name="status">
				<Form.Control>
					{#snippet children({ props })}
						<div class="flex items-center space-x-2">
							<!-- Real input for superforms serialization -->
							<input
								type="checkbox"
								class="sr-only"
								{...props}
								bind:checked={$createFormData.status}
							/>
							<Switch bind:checked={$createFormData.status} disabled={$createSubmitting} />
							<Label for={props.id}>เปิดใช้งานทันทีหลังสร้าง</Label>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createDialogOpen = false)}>
					ยกเลิก
				</Button>
				<Button type="submit" disabled={$createSubmitting}>
					{#if $createSubmitting}
						<IconLoader class="mr-2 h-4 w-4 animate-spin" />
						กำลังสร้าง...
					{:else}
						สร้างหน่วยงาน
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Faculty Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>แก้ไขหน่วยงาน</Dialog.Title>
			<Dialog.Description>แก้ไขข้อมูลของหน่วยงาน</Dialog.Description>
		</Dialog.Header>

		{#if editingFaculty}
			<div class="space-y-4">
				<div class="space-y-2">
					<Label>ชื่อหน่วยงาน</Label>
					<Input bind:value={editFormData.name} placeholder="เช่น หน่วยงานวิทยาศาสตร์" />
				</div>

				<div class="space-y-2">
					<Label>รหัสหน่วยงาน</Label>
					<Input bind:value={editFormData.code} placeholder="เช่น SCI" class="font-mono" />
				</div>

				<div class="space-y-2">
					<Label>คำอธิบาย</Label>
					<Textarea
						bind:value={editFormData.description}
						placeholder="คำอธิบายเพิ่มเติมเกี่ยวกับหน่วยงาน"
						rows={3}
					/>
				</div>

				<div class="space-y-2">
					<Label>ประเภทหน่วยงาน</Label>
					<Select.Root type="single" bind:value={editFormData.organizationType}>
						<Select.Trigger class="w-full">
							{editFormData.organizationType === 'faculty'
								? 'คณะ'
								: editFormData.organizationType === 'office'
									? 'หน่วยงาน'
									: 'เลือกประเภทหน่วยงาน'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="faculty">คณะ</Select.Item>
							<Select.Item value="office">หน่วยงาน</Select.Item>
						</Select.Content>
					</Select.Root>
					<p class="text-sm text-gray-600">
						{editFormData.organizationType === 'faculty'
							? 'คณะ: สามารถเพิ่มสาขาวิชาได้ และนักเรียนสามารถสมัครได้'
							: 'หน่วยงาน: ไม่สามารถเพิ่มสาขาวิชาได้ และนักเรียนไม่สามารถสมัครได้'}
					</p>
				</div>

				<div class="flex items-center space-x-2">
					<Switch bind:checked={editFormData.status} />
					<Label>สถานะการใช้งาน</Label>
				</div>

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>
						ยกเลิก
					</Button>
					<Button type="button" onclick={handleUpdate}>บันทึกการแก้ไข</Button>
				</Dialog.Footer>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Faculty Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ยืนยันการลบหน่วยงาน</AlertDialog.Title>
			<AlertDialog.Description>
				{#if facultyToDelete}
					คุณแน่ใจหรือไม่ที่จะลบหน่วยงาน "{facultyToDelete.name}"?<br />
					<strong class="text-red-600"
						>การดำเนินการนี้จะลบข้อมูลทั้งหมดที่เกี่ยวข้องกับหน่วยงานนี้
						รวมถึงภาควิชาและแอดมินในหน่วยงาน</strong
					><br />
					การดำเนินการนี้ไม่สามารถยกเลิกได้
				{:else}
					กำลังโหลดข้อมูล...
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					deleteDialogOpen = false;
					facultyToDelete = null;
				}}
			>
				ยกเลิก
			</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDelete} class="bg-red-600 text-white hover:bg-red-700">
				ลบหน่วยงาน
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
