<script lang="ts">
	import { departmentsApi, organizationsApi, ApiError } from '$lib/api';
	import type { Department, Organization, CreateDepartmentInput, UpdateDepartmentInput } from '$lib/api';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Card, CardContent, CardHeader, CardTitle
	} from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		IconSchool,
		IconPlus,
		IconEdit,
		IconTrash,
		IconSearch,
		IconRefresh,
		IconToggleLeft,
		IconToggleRight,
	} from '@tabler/icons-svelte/icons';

	// ─── State ──────────────────────────────────────────────────────────────
	let departments = $state<Department[]>([]);
	let organizations = $state<Organization[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchTerm = $state('');
	let filterOrg = $state('all');
	let filterStatus = $state('all');

	// Dialogs
	let createDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let selectedDept = $state<Department | null>(null);
	let saving = $state(false);

	// Form state
	let createForm = $state<CreateDepartmentInput>({
		name: '',
		code: '',
		description: null,
		organization_id: '',
		status: true,
	});

	let editForm = $state<UpdateDepartmentInput>({
		name: '',
		code: '',
		description: null,
		status: true,
	});

	// ─── Derived ────────────────────────────────────────────────────────────
	let filteredDepts = $derived(
		departments.filter((d) => {
			if (searchTerm.trim()) {
				const q = searchTerm.toLowerCase();
				if (!d.name.toLowerCase().includes(q) && !d.code.toLowerCase().includes(q)) return false;
			}
			if (filterOrg !== 'all' && d.organization_id !== filterOrg) return false;
			if (filterStatus !== 'all') {
				const isActive = filterStatus === 'active';
				if (d.status !== isActive) return false;
			}
			return true;
		})
	);

	let stats = $derived({
		total: departments.length,
		active: departments.filter((d) => d.status).length,
		inactive: departments.filter((d) => !d.status).length,
	});

	let orgOptions = $derived(
		organizations.map((o) => ({ value: o.id, label: o.name }))
	);

	// ─── Data Fetching ──────────────────────────────────────────────────────
	async function fetchData() {
		loading = true;
		error = null;
		try {
			const [deptData, orgData] = await Promise.all([
				departmentsApi.list(),
				organizationsApi.listAdmin(),
			]);
			departments = deptData;
			organizations = orgData;
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลได้';
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	// ─── Actions ────────────────────────────────────────────────────────────
	function openCreate() {
		createForm = { name: '', code: '', description: null, organization_id: '', status: true };
		createDialogOpen = true;
	}

	function openEdit(dept: Department) {
		selectedDept = dept;
		editForm = { name: dept.name, code: dept.code, description: dept.description, status: dept.status };
		editDialogOpen = true;
	}

	function openDelete(dept: Department) {
		selectedDept = dept;
		deleteDialogOpen = true;
	}

	async function handleCreate() {
		if (!createForm.name.trim() || !createForm.code.trim() || !createForm.organization_id) {
			toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
			return;
		}
		saving = true;
		try {
			await departmentsApi.create(createForm);
			toast.success('สร้างภาควิชาสำเร็จ');
			createDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถสร้างภาควิชา: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleEdit() {
		if (!selectedDept) return;
		saving = true;
		try {
			await departmentsApi.update(selectedDept.id, editForm);
			toast.success('แก้ไขภาควิชาสำเร็จ');
			editDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถแก้ไข: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!selectedDept) return;
		saving = true;
		try {
			await departmentsApi.delete(selectedDept.id);
			toast.success('ลบภาควิชาสำเร็จ');
			deleteDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถลบ: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleToggleStatus(dept: Department) {
		try {
			await departmentsApi.toggleStatus(dept.id);
			toast.success(`${dept.status ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}ภาควิชาสำเร็จ`);
			await fetchData();
		} catch {
			toast.error('ไม่สามารถเปลี่ยนสถานะได้');
		}
	}
</script>

<svelte:head>
	<title>จัดการภาควิชา - Trackivity Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">จัดการภาควิชา</h1>
			<p class="text-muted-foreground">ภาควิชาและสาขาวิชาทั้งหมดในระบบ</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={fetchData} disabled={loading}>
				<IconRefresh class="mr-2 size-4 {loading ? 'animate-spin' : ''}" />
				รีเฟรช
			</Button>
			<Button onclick={openCreate}>
				<IconPlus class="mr-2 size-4" />
				เพิ่มภาควิชา
			</Button>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		{#each [
			{ label: 'ทั้งหมด', value: stats.total },
			{ label: 'เปิดใช้งาน', value: stats.active },
			{ label: 'ปิดใช้งาน', value: stats.inactive },
		] as stat}
			<Card>
				<CardContent class="p-4">
					<p class="text-2xl font-bold">{stat.value}</p>
					<p class="text-sm text-muted-foreground">{stat.label}</p>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Filter + Table -->
	<Card>
		<CardHeader>
			<div class="flex flex-col gap-3 sm:flex-row">
				<div class="relative flex-1">
					<IconSearch class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input bind:value={searchTerm} placeholder="ค้นหาภาควิชา..." class="pl-9" />
				</div>
				<select
					bind:value={filterOrg}
					class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm sm:w-48"
				>
					<option value="all">หน่วยงานทั้งหมด</option>
					{#each organizations as org}
						<option value={org.id}>{org.name}</option>
					{/each}
				</select>
				<select
					bind:value={filterStatus}
					class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm sm:w-40"
				>
					<option value="all">สถานะทั้งหมด</option>
					<option value="active">เปิดใช้งาน</option>
					<option value="inactive">ปิดใช้งาน</option>
				</select>
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="space-y-3">
					{#each Array(5) as _}
						<Skeleton class="h-10 w-full" />
					{/each}
				</div>
			{:else if error}
				<div class="py-8 text-center text-destructive">{error}</div>
			{:else if filteredDepts.length === 0}
				<div class="py-12 text-center">
					<IconSchool class="mx-auto mb-4 size-12 text-muted-foreground/50" />
					<p class="text-muted-foreground">ไม่พบภาควิชา</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ชื่อภาควิชา</Table.Head>
							<Table.Head>รหัส</Table.Head>
							<Table.Head>หน่วยงาน</Table.Head>
							<Table.Head>นักศึกษา</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head class="text-right">การจัดการ</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredDepts as dept}
							<Table.Row>
								<Table.Cell>
									<div>
										<p class="font-medium">{dept.name}</p>
										{#if dept.description}
											<p class="text-xs text-muted-foreground">{dept.description}</p>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell>
									<code class="rounded bg-muted px-1 py-0.5 text-sm">{dept.code}</code>
								</Table.Cell>
								<Table.Cell>
									<span class="text-sm">{dept.organization_name ?? '-'}</span>
								</Table.Cell>
								<Table.Cell>
									<span>{dept.students_count ?? 0}</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={dept.status ? 'default' : 'secondary'}>
										{dept.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
									</Badge>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex items-center justify-end gap-1">
										<Button variant="ghost" size="sm" onclick={() => handleToggleStatus(dept)}>
											{#if dept.status}
												<IconToggleRight class="size-4 text-green-600" />
											{:else}
												<IconToggleLeft class="size-4 text-muted-foreground" />
											{/if}
										</Button>
										<Button variant="ghost" size="sm" onclick={() => openEdit(dept)}>
											<IconEdit class="size-4" />
										</Button>
										<Button variant="ghost" size="sm" onclick={() => openDelete(dept)}>
											<IconTrash class="size-4 text-destructive" />
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</CardContent>
	</Card>
</div>

<!-- Create Dialog -->
<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>เพิ่มภาควิชาใหม่</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1">
				<Label>หน่วยงาน *</Label>
				<Select.Root type="single" bind:value={createForm.organization_id}>
					<Select.Trigger class="w-full">
						{orgOptions.find((o) => o.value === createForm.organization_id)?.label ?? 'เลือกหน่วยงาน'}
					</Select.Trigger>
					<Select.Content>
						{#each orgOptions as opt}
							<Select.Item value={opt.value}>{opt.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-1">
				<Label>ชื่อภาควิชา *</Label>
				<Input bind:value={createForm.name} placeholder="ชื่อภาควิชา" />
			</div>
			<div class="space-y-1">
				<Label>รหัสภาควิชา *</Label>
				<Input bind:value={createForm.code} placeholder="รหัส เช่น CS, ME" />
			</div>
			<div class="space-y-1">
				<Label>คำอธิบาย</Label>
				<Input bind:value={createForm.description} placeholder="คำอธิบาย (ไม่บังคับ)" />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => createDialogOpen = false}>ยกเลิก</Button>
			<Button onclick={handleCreate} disabled={saving}>
				{saving ? 'กำลังบันทึก...' : 'สร้างภาควิชา'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>แก้ไขภาควิชา</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1">
				<Label>ชื่อภาควิชา *</Label>
				<Input bind:value={editForm.name} placeholder="ชื่อภาควิชา" />
			</div>
			<div class="space-y-1">
				<Label>รหัสภาควิชา *</Label>
				<Input bind:value={editForm.code} placeholder="รหัส เช่น CS, ME" />
			</div>
			<div class="space-y-1">
				<Label>คำอธิบาย</Label>
				<Input bind:value={editForm.description} placeholder="คำอธิบาย (ไม่บังคับ)" />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => editDialogOpen = false}>ยกเลิก</Button>
			<Button onclick={handleEdit} disabled={saving}>
				{saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>ยืนยันการลบ</Dialog.Title>
			<Dialog.Description>
				คุณต้องการลบภาควิชา <strong>{selectedDept?.name}</strong> ใช่หรือไม่?
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => deleteDialogOpen = false}>ยกเลิก</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={saving}>
				{saving ? 'กำลังลบ...' : 'ยืนยันการลบ'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
