<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { z } from 'zod';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
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
	import * as Select from '$lib/components/ui/select';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import {
		IconLoader,
		IconPlus,
		IconEdit,
		IconTrash,
		IconShield,
		IconToggleLeft,
		IconToggleRight,
		IconUsers,
		IconSearch,
		IconFilter,
		IconUserCheck,
		IconSchool,
		IconEye,
		IconCalendar,
		IconMail,
		IconBuilding
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll, invalidate } from '$app/navigation';
	import type { ExtendedAdminRole } from '$lib/types/admin';
	import { AdminLevel, ADMIN_PERMISSIONS } from '$lib/types/admin';
	import { PrefixOptions } from '$lib/schemas/auth';

	let { data } = $props();
	let refreshing = $state(false);

	// Admin creation schema
	const adminCreateSchema = z.object({
		name: z.string().min(1, 'กรุณากรอกชื่อ'),
		email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
		password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร').optional(),
		organization_id: z.string().min(1, 'กรุณาเลือกหน่วยงาน'),
		admin_level: z.nativeEnum(AdminLevel).default(AdminLevel.OrganizationAdmin),
		permissions: z.array(z.string()).default([])
	});

	// Forms
	const createForm = superForm(data.form, {
		validators: zodClient(adminCreateSchema),
		onResult: async ({ result }) => {
			if (result.type === 'success') {
				toast.success('สร้างแอดมินหน่วยงานสำเร็จ');
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
				toast.error('เกิดข้อผิดพลาดในการสร้างแอดมินหน่วยงาน');
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
	let createGeneralAdminDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let viewDialogOpen = $state(false);

	// Edit form states
	let editingAdmin = $state<ExtendedAdminRole | null>(null);
	let editFormData = $state({
		first_name: '',
		last_name: '',
		email: '',
		status: 'active',
		organization_id: '',
		permissions: []
	} as any);

	// View dialog state
	let viewingAdmin = $state<ExtendedAdminRole | null>(null);

	// Delete state
	let adminToDelete = $state<{ id: string; name: string } | null>(null);

	// Toggle loading
	let toggleLoading = $state<{ [key: string]: boolean }>({});

	// Search and filter states
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'active' | 'inactive'>('all');
	let facultyFilter = $state<string>('all');

	// Selected permissions for create form
	let selectedPermissions = $state<string[]>([
		ADMIN_PERMISSIONS.VIEW_DASHBOARD,
		ADMIN_PERMISSIONS.MANAGE_FACULTY_USERS
	]);

	// Form data for general admin creation (used by FacultyAdmin)
	let generalAdminFormData = $state({
		name: '',
		email: '',
		password: '',
		admin_level: AdminLevel.RegularAdmin,
		organization_id: data.userOrganizationId || '',
		permissions: [ADMIN_PERMISSIONS.VIEW_DASHBOARD, ADMIN_PERMISSIONS.MANAGE_ACTIVITIES]
	});

	// Available permissions list
	const availablePermissions = [
		{ value: ADMIN_PERMISSIONS.VIEW_DASHBOARD, label: 'ดูแดชบอร์ด' },
		{ value: ADMIN_PERMISSIONS.MANAGE_ACTIVITIES, label: 'จัดการกิจกรรม' },
		{ value: ADMIN_PERMISSIONS.MANAGE_USERS, label: 'จัดการผู้ใช้ทั่วไป' },
		{ value: ADMIN_PERMISSIONS.MANAGE_FACULTY_USERS, label: 'จัดการผู้ใช้ในหน่วยงาน' },
		{ value: ADMIN_PERMISSIONS.MANAGE_DEPARTMENTS, label: 'จัดการภาควิชา' },
		{ value: ADMIN_PERMISSIONS.VIEW_REPORTS, label: 'ดูรายงาน' },
		{ value: ADMIN_PERMISSIONS.MANAGE_FACULTY_SETTINGS, label: 'จัดการการตั้งค่าหน่วยงาน' },
		{ value: ADMIN_PERMISSIONS.EXPORT_DATA, label: 'ส่งออกข้อมูล' }
	];

	// Filtered admins
	let filteredAdmins = $derived(() => {
		let filtered = data.organizationAdmins as any[];

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(admin: any) =>
					admin.full_name?.toLowerCase().includes(query) ||
					admin.user?.email.toLowerCase().includes(query) ||
					admin.organization?.name?.toLowerCase().includes(query)
			);
		}

		// Apply status filter
		if (statusFilter !== 'all') {
			filtered = filtered.filter((admin) =>
				statusFilter === 'active' ? admin.is_active : !admin.is_active
			);
		}

		// Apply faculty filter
		if (facultyFilter !== 'all') {
			filtered = filtered.filter((admin: any) => admin.organization_id === facultyFilter);
		}

		return filtered;
	});

	// Stats (using data from server)
	let stats = $derived(data.stats);

	function openCreateDialog() {
		$createFormData = {
			prefix: '',
			first_name: '',
			last_name: '',
			email: '',
			password: '',
			organization_id: data.isSuperAdmin ? '' : data.userOrganizationId || '',
			admin_level: AdminLevel.OrganizationAdmin,
			permissions: selectedPermissions
		};
		selectedPermissions = [
			ADMIN_PERMISSIONS.VIEW_DASHBOARD,
			ADMIN_PERMISSIONS.MANAGE_FACULTY_USERS
		];
		createDialogOpen = true;
	}

	function openCreateGeneralAdminDialog() {
		generalAdminFormData = {
			name: '',
			email: '',
			password: '',
			admin_level: AdminLevel.RegularAdmin,
			organization_id: data.userOrganizationId || '',
			permissions: [ADMIN_PERMISSIONS.VIEW_DASHBOARD, ADMIN_PERMISSIONS.MANAGE_ACTIVITIES]
		};
		createGeneralAdminDialogOpen = true;
	}

	function openEditDialog(admin: ExtendedAdminRole) {
		editingAdmin = admin;
		editFormData = {
			first_name: admin.user?.first_name || '',
			last_name: admin.user?.last_name || '',
			email: admin.user?.email || '',
			status: (admin.user?.status as any) || 'active',
			organization_id: (admin as any).organization_id || '',
			permissions: admin.permissions || []
		} as any;
		editDialogOpen = true;
	}

	function openViewDialog(admin: ExtendedAdminRole) {
		viewingAdmin = admin;
		viewDialogOpen = true;
	}

	function openDeleteDialog(adminId: string, adminName: string) {
		adminToDelete = { id: adminId, name: adminName };
		deleteDialogOpen = true;
	}

	async function handleUpdate() {
		if (!editingAdmin) return;

		try {
			const formData = new FormData();
			formData.append('adminId', editingAdmin.id);
			formData.append('userId', editingAdmin.user_id);
			formData.append('updateData', JSON.stringify(editFormData));

			const response = await fetch('?/update', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('แก้ไขข้อมูลแอดมินหน่วยงานสำเร็จ');
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
				toast.error('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
			}
		} catch (error) {
			console.error('Update error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	async function handleDelete() {
		if (!adminToDelete) return;

		try {
			const formData = new FormData();
			formData.append('adminId', adminToDelete.id);

			const response = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('ลบแอดมินหน่วยงานสำเร็จ');
				deleteDialogOpen = false;
				adminToDelete = null;
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
				toast.error('เกิดข้อผิดพลาดในการลบแอดมิน');
			}
		} catch (error) {
			console.error('Delete error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	async function handleToggleStatus(adminId: string, currentActive: boolean) {
		const newStatus = !currentActive;
		const actionText = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

		toggleLoading = { ...toggleLoading, [adminId]: true };

		try {
			const formData = new FormData();
			formData.append('adminId', adminId);
			formData.append('isActive', newStatus.toString());

			const response = await fetch('?/toggleStatus', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(`${actionText}แอดมินหน่วยงานสำเร็จ`);
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
				toast.error(result.error || `เกิดข้อผิดพลาดในการ${actionText}แอดมิน`);
			}
		} catch (error) {
			console.error('Toggle status error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			toggleLoading = { ...toggleLoading, [adminId]: false };
		}
	}

	function clearSearch() {
		searchQuery = '';
	}

	function formatPermissionName(permission: string): string {
		const permissionMap = availablePermissions.find((p) => p.value === permission);
		return permissionMap?.label || permission;
	}

	// Function to get combined admin status for display
	function getAdminCombinedStatus(admin: ExtendedAdminRole): {
		isEnabled: boolean;
		isActive: boolean;
		statusText: string;
		badgeClass: string;
		dotClass: string;
	} {
		// Check if admin account is enabled (can login)
		const isEnabled =
			'is_enabled' in admin && admin.is_enabled !== undefined
				? Boolean(admin.is_enabled)
				: Boolean(admin.permissions && admin.permissions.length > 0);

		// Check if admin has active login session
		const isActive =
			'is_active' in admin && admin.is_active !== undefined && admin.is_active !== null
				? Boolean(admin.is_active)
				: false;

		// Determine combined status
		let statusText: string;
		let badgeClass: string;
		let dotClass: string;

		if (!isEnabled) {
			statusText = 'ปิดใช้งาน';
			badgeClass = 'bg-red-100 text-red-800 hover:bg-red-100';
			dotClass = 'bg-red-500';
		} else if (isActive) {
			statusText = 'ใช้งานอยู่';
			badgeClass = 'bg-green-100 text-green-800 hover:bg-green-100';
			dotClass = 'bg-green-500';
		} else {
			statusText = 'ไม่ออนไลน์';
			badgeClass = 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
			dotClass = 'bg-yellow-500';
		}

		return {
			isEnabled,
			isActive,
			statusText,
			badgeClass,
			dotClass
		};
	}

	async function handleCreateGeneralAdmin() {
		try {
			const formData = new FormData();
			formData.append('name', generalAdminFormData.name);
			formData.append('email', generalAdminFormData.email);
			formData.append('password', generalAdminFormData.password);
			formData.append('admin_level', generalAdminFormData.admin_level);
			formData.append('organization_id', (generalAdminFormData as any).organization_id);
			formData.append('permissions', JSON.stringify(generalAdminFormData.permissions));

			const response = await fetch('?/create', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('สร้างแอดมินทั่วไปสำเร็จ');
				createGeneralAdminDialogOpen = false;

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
			} else {
				toast.error('เกิดข้อผิดพลาดในการสร้างแอดมินทั่วไป');
			}
		} catch (error) {
			console.error('Create general admin error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	// Get page title based on user role
	let pageTitle = $derived(
		!data.isSuperAdmin && data.currentOrganization
			? `จัดการแอดมินหน่วยงาน - ${(data.currentOrganization as any)?.name}`
			: 'จัดการแอดมินหน่วยงาน'
	);
</script>

<svelte:head>
    <title>{pageTitle} - Trackivity</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1
				id="faculty-admin-management-heading"
				class="admin-page-title"
			>
				<IconShield class="size-6 text-primary" /> {pageTitle}
			</h1>
			<p class="mt-3 text-lg text-gray-600 dark:text-gray-400">
				{#if data.isSuperAdmin}
					จัดการแอดมินหน่วยงานในระบบ รวมถึงการสร้าง แก้ไข และจัดการสิทธิ์การเข้าถึง
				{:else}
					ดูรายการแอดมินในหน่วยงานของคุณ และติดตามกิจกรรมการเข้าใช้งาน
				{/if}
			</p>
		</div>
		<div class="flex gap-2">
			{#if data.isSuperAdmin}
				<Button
					onclick={openCreateDialog}
					class="bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
				>
					<IconPlus class="mr-2 h-5 w-5" />
					เพิ่มแอดมินหน่วยงาน
				</Button>
			{:else}
				<Button
					onclick={openCreateGeneralAdminDialog}
					class="bg-green-600 px-6 py-3 text-base font-medium text-white hover:bg-green-700"
				>
					<IconPlus class="mr-2 h-5 w-5" />
					เพิ่มแอดมินทั่วไป
				</Button>
			{/if}
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">แอดมินทั้งหมด</CardTitle>
				<IconShield class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.total_admins}</div>
				{#if data.isSuperAdmin && (stats.total_organizations ?? 0) > 0}
					<p class="text-xs text-muted-foreground">
						ใน {stats.total_organizations} หน่วยงาน
					</p>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เปิดใช้งาน</CardTitle>
				<IconUserCheck class="h-4 w-4 text-green-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-green-600">
					{stats?.active_admins ?? 0}
				</div>
				<p class="text-xs text-muted-foreground">
					{(((stats?.active_admins ?? 0) / ((stats?.total_admins ?? 0) || 1)) * 100).toFixed(0)}%
					ของทั้งหมด
				</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ปิดใช้งาน</CardTitle>
				<IconUsers class="h-4 w-4 text-red-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-red-600">
					{stats?.inactive_admins ?? 0}
				</div>
				{#if (stats?.inactive_admins ?? 0) > 0}
					<p class="text-xs text-muted-foreground">ต้องการการตรวจสอบ</p>
				{:else}
					<p class="text-xs text-green-600">ทุกคนใช้งานได้</p>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เข้าใช้ล่าสุด</CardTitle>
				<IconCalendar class="h-4 w-4 text-blue-500" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-blue-600">
					{stats.recent_logins}
				</div>
				<p class="text-xs text-muted-foreground">ใน 7 วันที่ผ่านมา</p>
			</CardContent>
		</Card>
	</div>

	<!-- Search and Filter -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-3">
				<IconFilter class="h-6 w-6 text-blue-600" />
				ค้นหาและกรอง
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="flex-1">
					<div class="relative">
						<IconSearch
							class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
						/>
						<Input
							bind:value={searchQuery}
							placeholder="ค้นหาชื่อ, อีเมล, หรือหน่วยงาน..."
							class="pr-10 pl-10"
						/>
						{#if searchQuery}
							<Button
								variant="ghost"
								size="sm"
								onclick={clearSearch}
								class="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 transform p-0"
							>
								<span class="sr-only">ล้างการค้นหา</span>
								×
							</Button>
						{/if}
					</div>
				</div>
				<div class="flex gap-2">
					<Button
						variant={statusFilter === 'all' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (statusFilter = 'all')}
					>
						ทั้งหมด ({stats.total_admins})
					</Button>
					<Button
						variant={statusFilter === 'active' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (statusFilter = 'active')}
						class="border-green-600 text-green-600 hover:bg-green-50"
					>
						เปิดใช้งาน ({stats.active_admins})
					</Button>
					<Button
						variant={statusFilter === 'inactive' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (statusFilter = 'inactive')}
						class="border-red-600 text-red-600 hover:bg-red-50"
					>
						ปิดใช้งาน ({stats.inactive_admins})
					</Button>
				</div>
			</div>

			{#if data.isSuperAdmin && (data.organizations?.length || 0) > 1}
				<div>
					<Label class="text-sm font-medium">กรองตามหน่วยงาน</Label>
					<Select.Root type="single" bind:value={facultyFilter}>
						<Select.Trigger class="mt-1 w-[180px]">
							{facultyFilter === 'all'
								? 'ทุกหน่วยงาน'
								: (data.organizations as any[])?.find((f: any) => f.id === facultyFilter)?.name ||
									'เลือกหน่วยงาน'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกหน่วยงาน</Select.Item>
							{#each data.organizations || [] as faculty}
								<Select.Item value={faculty.id}>{faculty.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Faculty Admins Table -->
	<div class="space-y-6" role="main" aria-labelledby="faculty-admin-management-heading">
		{#if refreshing}
			<div class="flex items-center justify-center py-12" role="status" aria-live="polite">
				<IconLoader class="mr-3 h-8 w-8 animate-spin text-blue-500" />
				<span class="text-lg text-gray-600 dark:text-gray-300">กำลังรีเฟรชข้อมูล...</span>
			</div>
		{:else if filteredAdmins().length === 0}
			<div class="py-16 text-center text-gray-500 dark:text-gray-400">
				{#if searchQuery || statusFilter !== 'all'}
					<IconSearch class="mx-auto mb-6 h-16 w-16 opacity-50" />
					<h3 class="mb-2 text-xl font-semibold">ไม่พบข้อมูลที่ตรงกับการค้นหา</h3>
					<p class="mb-6 text-gray-400">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่</p>
					<Button onclick={clearSearch} variant="outline">ล้างการค้นหา</Button>
				{:else}
					<IconShield class="mx-auto mb-6 h-16 w-16 opacity-50" />
					<h3 class="mb-2 text-xl font-semibold">
						{#if data.isSuperAdmin}
							ยังไม่มีแอดมินหน่วยงานในระบบ
						{:else}
							ยังไม่มีแอดมินหน่วยงานในหน่วยงานนี้
						{/if}
					</h3>
					<p class="mb-6 text-gray-400">
						{#if data.isSuperAdmin}
							เริ่มต้นด้วยการเพิ่มแอดมินหน่วยงานคนแรก
						{:else}
							ติดต่อซุปเปอร์แอดมินเพื่อเพิ่มแอดมินหน่วยงาน
						{/if}
					</p>
					{#if data.isSuperAdmin}
						<Button
							onclick={openCreateDialog}
							class="bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
						>
							<IconPlus class="mr-2 h-5 w-5" />
							เพิ่มแอดมินหน่วยงานแรก
						</Button>
					{:else}
						<Button
							onclick={openCreateGeneralAdminDialog}
							class="bg-green-600 px-6 py-3 text-white hover:bg-green-700"
						>
							<IconPlus class="mr-2 h-5 w-5" />
							เพิ่มแอดมินทั่วไปแรก
						</Button>
					{/if}
				{/if}
			</div>
		{:else}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-3">
						<IconShield class="h-6 w-6 text-blue-600" />
						รายการแอดมินหน่วยงาน
						<Badge variant="secondary" class="ml-2">
							{filteredAdmins().length} รายการ
						</Badge>
					</CardTitle>
					<CardDescription>
						จัดการข้อมูลและสิทธิ์การเข้าถึงของแอดมินหน่วยงานและแอดมินทั่วไปในหน่วยงาน
					</CardDescription>
				</CardHeader>
				<CardContent class="p-0">
					<div class="overflow-hidden">
						<Table.Root>
							<Table.Header>
								<Table.Row class="bg-gray-50 dark:bg-gray-800">
									<Table.Head class="font-semibold">ชื่อและข้อมูล</Table.Head>
									{#if data.isSuperAdmin}
										<Table.Head class="font-semibold">หน่วยงาน</Table.Head>
									{/if}
									<Table.Head class="font-semibold">บทบาท</Table.Head>
									<Table.Head class="font-semibold">ภาควิชาที่ดูแล</Table.Head>
									<Table.Head class="font-semibold">สิทธิ์การเข้าถึง</Table.Head>
									<Table.Head class="font-semibold">สถานะ</Table.Head>
									<Table.Head class="font-semibold">เข้าใช้ล่าสุด</Table.Head>
									<Table.Head class="text-right font-semibold">การดำเนินการ</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each filteredAdmins() as admin (admin.id)}
									<Table.Row class="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
										<Table.Cell class="py-4 font-medium">
											<div class="flex items-center gap-3">
												<div
													class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900"
												>
													<IconShield class="h-6 w-6 text-blue-600 dark:text-blue-400" />
												</div>
												<div>
													<div class="font-semibold text-gray-900 dark:text-gray-100">
														{admin.full_name}
													</div>
													<div
														class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400"
													>
														<IconMail class="h-3 w-3" />
														{admin.user?.email}
													</div>
													<div class="text-xs text-gray-400">
														สร้างเมื่อ: {admin.created_at_formatted}
													</div>
												</div>
											</div>
										</Table.Cell>
										{#if data.isSuperAdmin}
											<Table.Cell class="py-4">
												{#if admin.organization}
													<Badge variant="outline" class="flex items-center gap-1">
														<IconSchool class="h-3 w-3" />
														{admin.organization.name}
													</Badge>
												{:else}
													<span class="text-gray-400">-</span>
												{/if}
											</Table.Cell>
										{/if}
										<Table.Cell class="py-4">
											<div class="flex flex-wrap gap-1">
												<Badge
													variant={admin.admin_level === AdminLevel.OrganizationAdmin
														? 'default'
														: 'secondary'}
													class="flex items-center gap-1 text-xs"
												>
													<IconShield class="h-3 w-3" />
													{admin.admin_level === AdminLevel.OrganizationAdmin
														? 'แอดมินหน่วยงาน'
														: 'แอดมินทั่วไป'}
												</Badge>
												{#if admin.assigned_departments && admin.assigned_departments.length > 0}
													<Badge variant="secondary" class="flex items-center gap-1 text-xs">
														<IconBuilding class="h-3 w-3" />
														แอดมินภาควิชา
													</Badge>
												{/if}
											</div>
										</Table.Cell>
										<Table.Cell class="py-4">
											{#if admin.assigned_departments && admin.assigned_departments.length > 0}
												<div class="space-y-1">
													{#each admin.assigned_departments.slice(0, 2) as department}
														<Badge variant="outline" class="text-xs">
															{department.name}
														</Badge>
													{/each}
													{#if admin.assigned_departments.length > 2}
														<Badge variant="secondary" class="text-xs">
															+{admin.assigned_departments.length - 2} อื่นๆ
														</Badge>
													{/if}
													<div class="mt-1 text-xs text-gray-400">
														{admin.department_count || admin.assigned_departments.length} ภาควิชา
													</div>
												</div>
											{:else}
												<span class="text-sm text-gray-400">ไม่ได้ดูแลภาควิชา</span>
											{/if}
										</Table.Cell>
										<Table.Cell class="py-4">
											<div class="flex max-w-xs flex-wrap gap-1">
												{#each admin.permissions.slice(0, 3) as permission}
													<Badge variant="secondary" class="text-xs">
														{formatPermissionName(permission)}
													</Badge>
												{/each}
												{#if admin.permissions.length > 3}
													<Badge variant="outline" class="text-xs">
														+{admin.permissions.length - 3} อื่นๆ
													</Badge>
												{/if}
												{#if admin.permissions.length === 0}
													<span class="text-sm text-gray-400">ไม่มีสิทธิ์</span>
												{/if}
											</div>
											<div class="mt-1 text-xs text-gray-400">
												{admin.permission_count} สิทธิ์
											</div>
										</Table.Cell>
										<Table.Cell class="py-4">
											{@const status = getAdminCombinedStatus(admin)}
											<Badge variant="default" class={status.badgeClass}>
												<span class="mr-2 h-2 w-2 rounded-full {status.dotClass}" aria-hidden="true"
												></span>
												{status.statusText}
											</Badge>
										</Table.Cell>
										<Table.Cell class="py-4 text-sm">
											<div class="text-gray-900 dark:text-gray-100">
												{admin.last_login_formatted}
											</div>
											{#if admin.days_since_last_login !== null}
												<div class="text-xs text-gray-400">
													{admin.days_since_last_login} วันที่แล้ว
												</div>
											{/if}
										</Table.Cell>
										<Table.Cell class="py-4 text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													onclick={() => openViewDialog(admin)}
													class="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
													title="ดูรายละเอียด"
												>
													<IconEye class="h-4 w-4" />
												</Button>

												{#if data.isSuperAdmin}
													<Button
														variant="ghost"
														size="sm"
														onclick={() => handleToggleStatus(admin.id, admin.is_active ?? false)}
														disabled={toggleLoading[admin.id] || false}
														class="{admin.is_active
															? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
															: 'text-green-600 hover:bg-green-50 hover:text-green-700'} transition-colors"
														title="{admin.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}แอดมิน"
													>
														{#if toggleLoading[admin.id]}
															<IconLoader class="h-4 w-4 animate-spin" />
														{:else if admin.is_active}
															<IconToggleLeft class="h-4 w-4" />
														{:else}
															<IconToggleRight class="h-4 w-4" />
														{/if}
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onclick={() => openEditDialog(admin)}
														class="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
														title="แก้ไขข้อมูล"
													>
														<IconEdit class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onclick={() =>
															openDeleteDialog(admin.user_id, admin.full_name || 'แอดมิน')}
														class="text-red-600 hover:bg-red-50 hover:text-red-700"
														title="ลบแอดมิน"
													>
														<IconTrash class="h-4 w-4" />
													</Button>
												{/if}
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

<!-- Create Faculty Admin Dialog -->
{#if data.isSuperAdmin}
	<Dialog.Root bind:open={createDialogOpen}>
		<Dialog.Content class="sm:max-w-2xl">
			<Dialog.Header>
				<Dialog.Title>เพิ่มแอดมินหน่วยงานใหม่</Dialog.Title>
				<Dialog.Description>
					สร้างบัญชีแอดมินหน่วยงานใหม่พร้อมกำหนดสิทธิ์การเข้าถึง
				</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/create" use:createEnhance class="space-y-4">
				{#if $createErrors._errors}
					<Alert variant="destructive">
						<AlertDescription>
							{$createErrors._errors[0]}
						</AlertDescription>
					</Alert>
				{/if}

				<Form.Field form={createForm} name="prefix">
					<Form.Control>
						{#snippet children({ props })}
							<Label for={props.id}>คำนำหน้า</Label>
							<Select.Root
								type="single"
								bind:value={$createFormData.prefix}
								disabled={$createSubmitting}
							>
								<Select.Trigger>
									{PrefixOptions.find((opt) => opt.value === $createFormData.prefix)?.label ??
										'เลือกคำนำหน้า'}
								</Select.Trigger>
								<Select.Content>
									{#each PrefixOptions as option}
										<Select.Item value={option.value}>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<input type="hidden" {...props} bind:value={$createFormData.prefix} />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Form.Field form={createForm} name="first_name">
						<Form.Control>
							{#snippet children({ props })}
								<Label for={props.id}>ชื่อจริง</Label>
								<Input
									{...props}
									bind:value={$createFormData.first_name}
									placeholder="เช่น สมชาย"
									disabled={$createSubmitting}
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Field form={createForm} name="last_name">
						<Form.Control>
							{#snippet children({ props })}
								<Label for={props.id}>นามสกุล</Label>
								<Input
									{...props}
									bind:value={$createFormData.last_name}
									placeholder="เช่น ใจดี"
									disabled={$createSubmitting}
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Form.Field form={createForm} name="email">
						<Form.Control>
							{#snippet children({ props })}
								<Label for={props.id}>อีเมล</Label>
								<Input
									{...props}
									type="email"
									bind:value={$createFormData.email}
									placeholder="เช่น admin@university.ac.th"
									disabled={$createSubmitting}
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>

				<Form.Field form={createForm} name="organization_id">
					<Form.Control>
						{#snippet children({ props })}
							<Label for={props.id}>หน่วยงาน</Label>
							<Select.Root type="single" bind:value={($createFormData as any).organization_id}>
								<Select.Trigger>
									{($createFormData as any).organization_id
										? (data.organizations as any[]).find(
												(f: any) => f.id === ($createFormData as any).organization_id
											)?.name
										: 'เลือกหน่วยงานที่จะดูแล'}
								</Select.Trigger>
								<Select.Content>
									{#each data.organizations as faculty}
										<Select.Item value={faculty.id}>{faculty.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<div class="space-y-3">
					<Label class="text-base font-medium">สิทธิ์การเข้าถึง</Label>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						{#each availablePermissions as permission}
							<div class="flex items-center space-x-2">
								<input
									type="checkbox"
									id="permission-{permission.value}"
									bind:group={selectedPermissions}
									value={permission.value}
									class="focus:ring-opacity-50 rounded border-gray-300 text-blue-600 focus:border-blue-300 focus:ring focus:ring-blue-200"
									disabled={$createSubmitting}
								/>
								<Label
									for="permission-{permission.value}"
									class="cursor-pointer text-sm font-normal"
								>
									{permission.label}
								</Label>
							</div>
						{/each}
					</div>
					<p class="text-xs text-gray-500">
						แอดมินหน่วยงานจะได้รับสิทธิ์พื้นฐานในการดูแดชบอร์ดและจัดการผู้ใช้ในหน่วยงาน
					</p>
				</div>

				<Dialog.Footer>
					<Button
						type="button"
						variant="outline"
						onclick={() => (createDialogOpen = false)}
						disabled={$createSubmitting}
					>
						ยกเลิก
					</Button>
					<Button type="submit" disabled={$createSubmitting}>
						{#if $createSubmitting}
							<IconLoader class="mr-2 h-4 w-4 animate-spin" />
							กำลังสร้าง...
						{:else}
							สร้างแอดมินหน่วยงาน
						{/if}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Create General Admin Dialog (for FacultyAdmin users) -->
{#if !data.isSuperAdmin}
	<Dialog.Root bind:open={createGeneralAdminDialogOpen}>
		<Dialog.Content class="sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>เพิ่มแอดมินทั่วไปใหม่</Dialog.Title>
				<Dialog.Description>
					สร้างบัญชีแอดมินทั่วไปสำหรับการจัดการในหน่วยงาน {data.currentOrganization?.name || ''}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="general-admin-name">ชื่อ-นามสกุล</Label>
					<Input
						id="general-admin-name"
						bind:value={generalAdminFormData.name}
						placeholder="เช่น นาย สมชาย ใจดี"
					/>
				</div>

				<div class="space-y-2">
					<Label for="general-admin-email">อีเมล</Label>
					<Input
						id="general-admin-email"
						type="email"
						bind:value={generalAdminFormData.email}
						placeholder="เช่น admin@university.ac.th"
					/>
				</div>

				<div class="space-y-2">
					<Label for="general-admin-password">รหัสผ่าน</Label>
					<Input
						id="general-admin-password"
						type="password"
						bind:value={generalAdminFormData.password}
						placeholder="กรุณาใส่รหัสผ่าน"
					/>
					<p class="text-xs text-gray-500">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
				</div>

				<div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
					<div class="flex items-center gap-2">
						<IconUsers class="h-4 w-4 text-blue-600" />
						<p class="text-sm font-medium text-blue-700 dark:text-blue-300">
							แอดมินทั่วไปจะได้รับสิทธิ์พื้นฐาน
						</p>
					</div>
					<ul class="mt-2 ml-6 space-y-1 text-xs text-blue-600 dark:text-blue-400">
						<li>• ดูแดชบอร์ด</li>
						<li>• จัดการกิจกรรม</li>
						<li>• สังกัดหน่วยงาน: {data.currentOrganization?.name || 'ไม่ระบุ'}</li>
					</ul>
				</div>

				<Dialog.Footer>
					<Button
						type="button"
						variant="outline"
						onclick={() => (createGeneralAdminDialogOpen = false)}
					>
						ยกเลิก
					</Button>
					<Button
						type="button"
						onclick={handleCreateGeneralAdmin}
						disabled={!generalAdminFormData.name ||
							!generalAdminFormData.email ||
							!generalAdminFormData.password}
					>
						<IconPlus class="mr-2 h-4 w-4" />
						สร้างแอดมินทั่วไป
					</Button>
				</Dialog.Footer>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- View Faculty Admin Dialog -->
<Dialog.Root bind:open={viewDialogOpen}>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<IconShield class="h-5 w-5 text-blue-600" />
				รายละเอียดแอดมินหน่วยงาน
			</Dialog.Title>
			<Dialog.Description>ข้อมูลและสิทธิ์การเข้าถึงของแอดมินหน่วยงาน</Dialog.Description>
		</Dialog.Header>

		{#if viewingAdmin}
			<div class="space-y-6">
				<!-- Basic Info -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</Label>
						<p class="font-semibold text-gray-900">{viewingAdmin.full_name}</p>
					</div>
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">อีเมล</Label>
						<p class="flex items-center gap-1 text-gray-700">
							<IconMail class="h-4 w-4" />
							{viewingAdmin.user?.email}
						</p>
					</div>
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">หน่วยงาน</Label>
						<p class="flex items-center gap-1 text-gray-700">
							<IconSchool class="h-4 w-4" />
							{viewingAdmin.organization?.name || 'ไม่ระบุ'}
						</p>
					</div>
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">สถานะ</Label>
						{#if viewingAdmin}
							{@const viewStatus = getAdminCombinedStatus(viewingAdmin)}
							<Badge variant="default" class={viewStatus.badgeClass}>
								<span class="mr-2 h-2 w-2 rounded-full {viewStatus.dotClass}" aria-hidden="true"
								></span>
								{viewStatus.statusText}
							</Badge>
						{/if}
					</div>
				</div>

				<!-- Activity Info -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">เข้าใช้ครั้งล่าสุด</Label>
						<p class="flex items-center gap-1 text-gray-700">
							<IconCalendar class="h-4 w-4" />
							{viewingAdmin.last_login_formatted}
						</p>
						{#if viewingAdmin.days_since_last_login !== null}
							<p class="text-xs text-gray-400">
								{viewingAdmin.days_since_last_login} วันที่แล้ว
							</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label class="text-sm font-medium text-gray-500">วันที่สร้าง</Label>
						<p class="text-gray-700">
							{viewingAdmin.created_at_formatted}
						</p>
					</div>
				</div>

				<!-- Department Assignments -->
				<div class="space-y-3">
					<Label class="text-base font-medium">ภาควิชาที่รับผิดชอบ</Label>
					{#if viewingAdmin.assigned_departments && viewingAdmin.assigned_departments.length > 0}
						<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
							{#each viewingAdmin.assigned_departments as department}
								<div
									class="flex items-center gap-2 rounded-lg border bg-purple-50 p-3 dark:bg-purple-900/20"
								>
									<IconBuilding class="h-4 w-4 text-purple-600" />
									<div class="flex-1">
										<span class="text-sm font-medium text-purple-800 dark:text-purple-200">
											{department.name}
										</span>
										{#if department.description}
											<p class="mt-1 text-xs text-purple-600 dark:text-purple-300">
												{department.description}
											</p>
										{/if}
									</div>
									<Badge variant="outline" class="text-xs">ภาควิชา</Badge>
								</div>
							{/each}
						</div>
						<p class="text-xs text-gray-500">
							รับผิดชอบทั้งหมด {viewingAdmin.department_count ||
								viewingAdmin.assigned_departments.length} ภาควิชา
						</p>
					{:else}
						<div class="py-8 text-center text-gray-500">
							<IconBuilding class="mx-auto mb-3 h-12 w-12 opacity-50" />
							<p class="text-sm">ไม่ได้รับมอบหมายให้ดูแลภาควิชาใดๆ</p>
							<p class="mt-1 text-xs text-gray-400">ทำหน้าที่เป็นแอดมินหน่วยงานเท่านั้น</p>
						</div>
					{/if}
				</div>

				<!-- Permissions -->
				<div class="space-y-3">
					<Label class="text-base font-medium">สิทธิ์การเข้าถึง</Label>
					<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
						{#each viewingAdmin.permissions as permission}
							<div class="flex items-center gap-2 rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
								<IconUserCheck class="h-4 w-4 text-blue-600" />
								<span class="text-sm text-blue-800 dark:text-blue-200">
									{formatPermissionName(permission)}
								</span>
							</div>
						{/each}
						{#if viewingAdmin.permissions.length === 0}
							<p class="col-span-2 text-gray-400 italic">ไม่มีสิทธิ์การเข้าถึงเพิ่มเติม</p>
						{/if}
					</div>
					<p class="text-xs text-gray-500">
						รวม {viewingAdmin.permission_count} สิทธิ์การเข้าถึง
					</p>
				</div>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (viewDialogOpen = false)}>ปิด</Button>
				{#if data.isSuperAdmin}
					<Button
						onclick={() => {
							viewDialogOpen = false;
							if (viewingAdmin) openEditDialog(viewingAdmin);
						}}
					>
						<IconEdit class="mr-2 h-4 w-4" />
						แก้ไขข้อมูล
					</Button>
				{/if}
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Faculty Admin Dialog -->
{#if data.isSuperAdmin}
	<Dialog.Root bind:open={editDialogOpen}>
		<Dialog.Content class="sm:max-w-2xl">
			<Dialog.Header>
				<Dialog.Title>แก้ไขข้อมูลแอดมินหน่วยงาน</Dialog.Title>
				<Dialog.Description>แก้ไขข้อมูลส่วนตัวและสิทธิ์การเข้าถึง</Dialog.Description>
			</Dialog.Header>

			{#if editingAdmin}
				<div class="space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label>ชื่อจริง</Label>
							<Input bind:value={editFormData.first_name} placeholder="เช่น สมชาย" />
						</div>
						<div class="space-y-2">
							<Label>นามสกุล</Label>
							<Input bind:value={editFormData.last_name} placeholder="เช่น ใจดี" />
						</div>
					</div>

					<div class="space-y-2">
						<Label>อีเมล</Label>
						<Input
							type="email"
							bind:value={editFormData.email}
							placeholder="เช่น admin@university.ac.th"
						/>
					</div>

					<div class="space-y-2">
						<Label>หน่วยงาน</Label>
						<Select.Root type="single" bind:value={editFormData.organization_id}>
							<Select.Trigger>
								{editFormData.organization_id
									? (data.organizations as any[]).find(
											(f: any) => f.id === editFormData.organization_id
										)?.name
									: 'เลือกหน่วยงาน'}
							</Select.Trigger>
							<Select.Content>
								{#each data.organizations as faculty}
									<Select.Item value={faculty.id}>{faculty.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-3">
						<Label class="text-base font-medium">สิทธิ์การเข้าถึง</Label>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							{#each availablePermissions as permission}
								<div class="flex items-center space-x-2">
									<input
										type="checkbox"
										id="edit-permission-{permission.value}"
										bind:group={editFormData.permissions}
										value={permission.value}
										class="focus:ring-opacity-50 rounded border-gray-300 text-blue-600 focus:border-blue-300 focus:ring focus:ring-blue-200"
									/>
									<Label
										for="edit-permission-{permission.value}"
										class="cursor-pointer text-sm font-normal"
									>
										{permission.label}
									</Label>
								</div>
							{/each}
						</div>
					</div>

					<div class="flex items-center space-x-2">
						<Switch
							checked={editFormData.status === 'active'}
							onCheckedChange={(checked: boolean) =>
								(editFormData.status = checked ? 'active' : 'inactive')}
						/>
						<Label>เปิดใช้งานบัญชี</Label>
					</div>

					<Dialog.Footer>
						<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>
							ยกเลิก
						</Button>
						<Button type="button" onclick={handleUpdate}>
							<IconEdit class="mr-2 h-4 w-4" />
							บันทึกการแก้ไข
						</Button>
					</Dialog.Footer>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Delete Faculty Admin Confirmation Dialog -->
{#if data.isSuperAdmin}
	<AlertDialog.Root bind:open={deleteDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>ยืนยันการลบแอดมินหน่วยงาน</AlertDialog.Title>
				<AlertDialog.Description>
					{#if adminToDelete}
						คุณแน่ใจหรือไม่ที่จะลบแอดมินหน่วยงาน "{adminToDelete.name}"?<br />
						<strong class="text-red-600">การดำเนินการนี้จะลบบัญชีและสิทธิ์การเข้าถึงทั้งหมด</strong
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
						adminToDelete = null;
					}}
				>
					ยกเลิก
				</AlertDialog.Cancel>
				<AlertDialog.Action onclick={handleDelete} class="bg-red-600 text-white hover:bg-red-700">
					ลบแอดมินหน่วยงาน
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
