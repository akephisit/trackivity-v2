<script lang="ts">
	import { organizationsApi, ApiError } from '$lib/api';
	import type { Organization, CreateOrganizationInput, UpdateOrganizationInput } from '$lib/api';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Card, CardContent, CardHeader, CardTitle, CardDescription
	} from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		IconBuilding,
		IconPlus,
		IconEdit,
		IconTrash,
		IconSearch,
		IconRefresh,
		IconToggleLeft,
		IconToggleRight,
	} from '@tabler/icons-svelte/icons';

	// ─── State ──────────────────────────────────────────────────────────────
	let organizations = $state<Organization[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchTerm = $state('');

	// Dialog state
	let createDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let selectedOrg = $state<Organization | null>(null);

	// Form state
	let createForm = $state<CreateOrganizationInput>({
		name: '',
		code: '',
		description: null,
		organization_type: 'faculty',
		status: true,
	});

	let editForm = $state<UpdateOrganizationInput>({
		name: '',
		code: '',
		description: null,
		organization_type: 'faculty',
		status: true,
	});

	let saving = $state(false);

	// ─── Derived ────────────────────────────────────────────────────────────
	let filteredOrgs = $derived(
		organizations.filter((o) => {
			if (!searchTerm.trim()) return true;
			const q = searchTerm.toLowerCase();
			return (
				o.name.toLowerCase().includes(q) ||
				o.code.toLowerCase().includes(q)
			);
		})
	);

	let stats = $derived({
		total: organizations.length,
		active: organizations.filter((o) => o.status).length,
		inactive: organizations.filter((o) => !o.status).length,
		faculty: organizations.filter((o) => o.organization_type === 'faculty').length,
		office: organizations.filter((o) => o.organization_type === 'office').length,
	});

	// ─── Data Fetching ──────────────────────────────────────────────────────
	async function fetchData() {
		loading = true;
		error = null;
		try {
			organizations = await organizationsApi.listAdmin();
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลได้';
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	// ─── Actions ────────────────────────────────────────────────────────────
	function openCreate() {
		createForm = { name: '', code: '', description: null, organization_type: 'faculty', status: true };
		createDialogOpen = true;
	}

	function openEdit(org: Organization) {
		selectedOrg = org;
		editForm = {
			name: org.name,
			code: org.code,
			description: org.description,
			organization_type: org.organization_type,
			status: org.status,
		};
		editDialogOpen = true;
	}

	function openDelete(org: Organization) {
		selectedOrg = org;
		deleteDialogOpen = true;
	}

	async function handleCreate() {
		if (!createForm.name.trim() || !createForm.code.trim()) {
			toast.error('กรุณากรอกชื่อและรหัสหน่วยงาน');
			return;
		}
		saving = true;
		try {
			await organizationsApi.create(createForm);
			toast.success('สร้างหน่วยงานสำเร็จ');
			createDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถสร้างหน่วยงาน: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleEdit() {
		if (!selectedOrg) return;
		saving = true;
		try {
			await organizationsApi.update(selectedOrg.id, editForm);
			toast.success('แก้ไขหน่วยงานสำเร็จ');
			editDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถแก้ไขหน่วยงาน: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!selectedOrg) return;
		saving = true;
		try {
			await organizationsApi.delete(selectedOrg.id);
			toast.success('ลบหน่วยงานสำเร็จ');
			deleteDialogOpen = false;
			await fetchData();
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด';
			toast.error(`ไม่สามารถลบหน่วยงาน: ${msg}`);
		} finally {
			saving = false;
		}
	}

	async function handleToggleStatus(org: Organization) {
		try {
			await organizationsApi.toggleStatus(org.id);
			toast.success(`${org.status ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}หน่วยงานสำเร็จ`);
			await fetchData();
		} catch (e) {
			toast.error('ไม่สามารถเปลี่ยนสถานะได้');
		}
	}

	function getTypeLabel(type: string) {
		return type === 'faculty' ? 'คณะ' : 'สำนักงาน';
	}
</script>

<svelte:head>
	<title>จัดการหน่วยงาน - Trackivity Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">จัดการหน่วยงาน</h1>
			<p class="text-muted-foreground">คณะและหน่วยงานทั้งหมดในระบบ</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={fetchData} disabled={loading}>
				<IconRefresh class="mr-2 size-4 {loading ? 'animate-spin' : ''}" />
				รีเฟรช
			</Button>
			<Button onclick={openCreate}>
				<IconPlus class="mr-2 size-4" />
				เพิ่มหน่วยงาน
			</Button>
		</div>
	</div>

	<!-- Stats cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
		{#each [
			{ label: 'ทั้งหมด', value: stats.total },
			{ label: 'เปิดใช้งาน', value: stats.active },
			{ label: 'ปิดใช้งาน', value: stats.inactive },
			{ label: 'คณะ', value: stats.faculty },
			{ label: 'สำนักงาน', value: stats.office },
		] as stat}
			<Card>
				<CardContent class="p-4">
					<p class="text-2xl font-bold">{stat.value}</p>
					<p class="text-sm text-muted-foreground">{stat.label}</p>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Search and Table -->
	<Card>
		<CardHeader>
			<div class="flex items-center gap-4">
				<div class="relative flex-1">
					<IconSearch class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input bind:value={searchTerm} placeholder="ค้นหาหน่วยงาน..." class="pl-9" />
				</div>
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
			{:else if filteredOrgs.length === 0}
				<div class="py-12 text-center">
					<IconBuilding class="mx-auto mb-4 size-12 text-muted-foreground/50" />
					<p class="text-muted-foreground">ไม่พบหน่วยงาน</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ชื่อหน่วยงาน</Table.Head>
							<Table.Head>รหัส</Table.Head>
							<Table.Head>ประเภท</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head class="text-right">การจัดการ</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredOrgs as org}
							<Table.Row>
								<Table.Cell>
									<div>
										<p class="font-medium">{org.name}</p>
										{#if org.description}
											<p class="text-xs text-muted-foreground">{org.description}</p>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell>
									<code class="rounded bg-muted px-1 py-0.5 text-sm">{org.code}</code>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={org.organization_type === 'faculty' ? 'default' : 'secondary'}>
										{getTypeLabel(org.organization_type)}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={org.status ? 'default' : 'secondary'}>
										{org.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
									</Badge>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex items-center justify-end gap-1">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => handleToggleStatus(org)}
											title={org.status ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
										>
											{#if org.status}
												<IconToggleRight class="size-4 text-green-600" />
											{:else}
												<IconToggleLeft class="size-4 text-muted-foreground" />
											{/if}
										</Button>
										<Button variant="ghost" size="sm" onclick={() => openEdit(org)}>
											<IconEdit class="size-4" />
										</Button>
										<Button variant="ghost" size="sm" onclick={() => openDelete(org)}>
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
			<Dialog.Title>เพิ่มหน่วยงานใหม่</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1">
				<Label>ชื่อหน่วยงาน *</Label>
				<Input bind:value={createForm.name} placeholder="ชื่อหน่วยงาน" />
			</div>
			<div class="space-y-1">
				<Label>รหัสหน่วยงาน *</Label>
				<Input bind:value={createForm.code} placeholder="รหัส เช่น ENG, SCI" />
			</div>
			<div class="space-y-1">
				<Label>คำอธิบาย</Label>
				<Input bind:value={createForm.description} placeholder="คำอธิบาย (ไม่บังคับ)" />
			</div>
			<div class="space-y-1">
				<Label>ประเภท</Label>
				<Select.Root type="single" bind:value={createForm.organization_type}>
					<Select.Trigger class="w-full">
						{createForm.organization_type === 'faculty' ? 'คณะ' : 'สำนักงาน'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="faculty">คณะ</Select.Item>
						<Select.Item value="office">สำนักงาน</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => createDialogOpen = false}>ยกเลิก</Button>
			<Button onclick={handleCreate} disabled={saving}>
				{saving ? 'กำลังบันทึก...' : 'สร้างหน่วยงาน'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>แก้ไขหน่วยงาน</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1">
				<Label>ชื่อหน่วยงาน *</Label>
				<Input bind:value={editForm.name} placeholder="ชื่อหน่วยงาน" />
			</div>
			<div class="space-y-1">
				<Label>รหัสหน่วยงาน *</Label>
				<Input bind:value={editForm.code} placeholder="รหัส เช่น ENG, SCI" />
			</div>
			<div class="space-y-1">
				<Label>คำอธิบาย</Label>
				<Input bind:value={editForm.description} placeholder="คำอธิบาย (ไม่บังคับ)" />
			</div>
			<div class="space-y-1">
				<Label>ประเภท</Label>
				<Select.Root type="single" bind:value={editForm.organization_type}>
					<Select.Trigger class="w-full">
						{editForm.organization_type === 'faculty' ? 'คณะ' : 'สำนักงาน'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="faculty">คณะ</Select.Item>
						<Select.Item value="office">สำนักงาน</Select.Item>
					</Select.Content>
				</Select.Root>
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

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>ยืนยันการลบ</Dialog.Title>
			<Dialog.Description>
				คุณต้องการลบหน่วยงาน <strong>{selectedOrg?.name}</strong> ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
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
