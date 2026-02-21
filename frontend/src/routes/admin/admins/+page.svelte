<script lang="ts">
	import { PrefixOptions } from '$lib/schemas/auth';
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
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Table from '$lib/components/ui/table';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Badge } from '$lib/components/ui/badge';
	import {
		IconLoader,
		IconPlus,
		IconEdit,
		IconTrash,
		IconShield,
		IconUsers,
		IconMail,
		IconToggleLeft,
		IconToggleRight,
		IconChevronDown,
		IconSearch,
		IconFilter
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import { AdminLevel, type AdminRole } from '$lib/types/admin';
	import { request } from '$lib/api';
	import { onMount } from 'svelte';

	// CSR state
	let adminsList = $state<any[]>([]);
	let facultiesList = $state<any[]>([]);
	let loadingData = $state(true);
	let refreshing = $state(false);

	onMount(async () => {
		try {
			const [adminsRes, orgsRes] = await Promise.all([
				request('/admins').catch(() => ({ admins: [] })),
				request('/organizations/admin').catch(() => [])
			]);
			adminsList = (adminsRes as any).admins ?? adminsRes ?? [];
			facultiesList = Array.isArray(orgsRes) ? orgsRes : [];
		} catch {
			// silent
		} finally {
			loadingData = false;
		}
	});

	// Legacy proxy so template still works
	const data = $derived({ admins: adminsList, faculties: facultiesList, form: null });

	// Search and filter states
	let searchQuery = $state('');
	let levelFilter = $state<AdminLevel | 'all'>('all');

	function clearSearch() {
		searchQuery = '';
		levelFilter = 'all';
	}

	// Filtered admins for search
	let filteredAdmins = $derived.by(() => {
		let filtered = data.admins || [];

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((admin: any) => {
				const fullName = formatFullName(admin.user).toLowerCase();
				const email = (admin.user?.email || '').toLowerCase();
				return fullName.includes(query) || email.includes(query);
			});
		}

		// Apply level filter
		if (levelFilter !== 'all') {
			filtered = filtered.filter((admin: any) => admin.admin_level === levelFilter);
		}

		return filtered;
	});

	// Simple form state (replaces superForm)
	let formData = $state({ prefix: '', first_name: '', last_name: '', email: '', password: '', admin_level: AdminLevel.RegularAdmin, organization_id: undefined as string | undefined });
	let formErrors = $state<Record<string, string>>({});
	let submitting = $state(false);

	function clearFormData() {
		formData = { prefix: '', first_name: '', last_name: '', email: '', password: '', admin_level: AdminLevel.RegularAdmin, organization_id: undefined };
		formErrors = {};
	}

	async function handleCreateSubmit() {
		submitting = true;
		try {
			const res = await fetch('?/create', {
				method: 'POST',
				body: JSON.stringify(formData),
				headers: { 'Content-Type': 'application/json' }
			});
			if (res.ok) {
				toast.success('สร้างแอดมินสำเร็จ');
				dialogOpen = false;
				window.location.reload();
			} else {
				toast.error('เกิดข้อผิดพลาดในการสร้างแอดมิน');
			}
		} catch {
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			submitting = false;
		}
	}

	let dialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let selectedAdminLevel = $state<AdminLevel | undefined>(undefined);
	let selectedFaculty = $state<string | undefined>(undefined);
	let selectedPrefix = $state<string | undefined>(undefined);
	let editingAdmin = $state<AdminRole | null>(null);
	let editSelectedAdminLevel = $state<AdminLevel | undefined>(undefined);
	let editSelectedFaculty = $state<string | undefined>(undefined);
	let editSelectedPrefix = $state<string | undefined>(undefined);

	// State for delete confirmation
	let deleteDialogOpen = $state(false);
	let adminToDelete = $state<{ id: string; userId: string; name: string } | null>(null);

	// State for toggle loading
	let toggleLoading = $state<{ [key: string]: boolean }>({});

	// Admin Level options
	const adminLevelOptions = [
		{ value: AdminLevel.RegularAdmin, label: 'แอดมินทั่วไป' },
		{ value: AdminLevel.OrganizationAdmin, label: 'แอดมินหน่วยงาน' },
		{ value: AdminLevel.SuperAdmin, label: 'ซุปเปอร์แอดมิน' }
	];

	// Faculty options
	let facultyOptions = $derived(
		data.faculties.map((faculty) => ({
			value: faculty.id, // Keep as string (UUID)
			label: faculty.name
		}))
	);

	// Update form data when select values change
	$effect(() => {
		if (selectedAdminLevel !== undefined) {
			formData.admin_level = selectedAdminLevel;
			if (
				selectedAdminLevel === AdminLevel.SuperAdmin ||
				selectedAdminLevel === AdminLevel.RegularAdmin
			) {
				selectedFaculty = undefined;
				formData.organization_id = undefined;
			}
		}
	});

	$effect(() => {
		if (selectedAdminLevel === AdminLevel.OrganizationAdmin && selectedFaculty !== undefined) {
			formData.organization_id = selectedFaculty;
		}
	});

	$effect(() => {
		if (selectedPrefix !== undefined) {
			formData.prefix = selectedPrefix;
		}
	});

	function getFacultyName(admin: AdminRole): string {
		const orgId = (admin as any).organization_id as string | undefined;
		if (!orgId) return '-';
		if ((admin as any).organization?.name) return (admin as any).organization.name;
		const faculty = (data.faculties as any[]).find((f: any) => f.id === orgId);
		return faculty?.name || 'ไม่พบข้อมูล';
	}

	function getRoleDisplayName(adminLevel: AdminLevel): string {
		switch (adminLevel) {
			case AdminLevel.SuperAdmin:
				return 'ซุปเปอร์แอดมิน';
			case AdminLevel.OrganizationAdmin:
				return 'แอดมินหน่วยงาน';
			case AdminLevel.RegularAdmin:
				return 'แอดมินทั่วไป';
			default:
				return 'ไม่ระบุ';
		}
	}

	function getPrefixLabel(value: string | undefined): string {
		if (!value) return '';
		const found = PrefixOptions.find((o) => o.value === value);
		return found ? found.label : '';
	}

	function formatFullName(
		user: { prefix?: string; first_name?: string; last_name?: string } | undefined
	): string {
		if (!user) return 'ไม่ระบุชื่อ';
		const first = user.first_name || '';
		const last = user.last_name || '';
		const prefixLabel = getPrefixLabel(user.prefix);
		const full = `${prefixLabel ? prefixLabel + ' ' : ''}${first} ${last}`.trim();
		return full || 'ไม่ระบุชื่อ';
	}

	function openDeleteDialog(adminId: string, userId: string, adminName: string) {
		adminToDelete = { id: adminId, userId: userId, name: adminName };
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!adminToDelete) return;

		try {
			const formData = new FormData();
			formData.append('adminId', adminToDelete.userId); // ใช้ userId เพื่อส่งไปยัง /api/users endpoint
			formData.append('userId', adminToDelete.userId); // ส่ง userId เพิ่มเติมเพื่อความชัดเจน

			const response = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('ลบแอดมินสำเร็จ');
				deleteDialogOpen = false;
				adminToDelete = null;
				setTimeout(() => window.location.reload(), 500);
			} else {
				toast.error('เกิดข้อผิดพลาดในการลบแอดมิน');
			}
		} catch (error) {
			console.error('Delete error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	function resetForm() {
		selectedAdminLevel = undefined;
		selectedFaculty = undefined;
		selectedPrefix = undefined;
		formData = { prefix: '', first_name: '', last_name: '', email: '', password: '', admin_level: AdminLevel.RegularAdmin, organization_id: undefined };
	}

	function openDialog() {
		resetForm();
		dialogOpen = true;
	}

	function openEditDialog(admin: AdminRole) {
		editingAdmin = admin;
		editSelectedAdminLevel = admin.admin_level;
		editSelectedFaculty = (admin as any).organization_id; // already string (UUID)
		editSelectedPrefix = admin.user?.prefix;
		editDialogOpen = true;
	}

	async function handleUpdate(
		adminId: string,
		userId: string,
		updateData: {
			first_name: string;
			last_name: string;
			email: string;
			prefix?: string;
			admin_level: AdminLevel;
			organization_id?: string;
			permissions: string[];
		}
	) {
		try {
			const formData = new FormData();
			formData.append('adminId', adminId); // เก็บ admin role id
			formData.append('userId', userId); // ส่ง user id เพื่อใช้กับ /api/users endpoint
			formData.append('updateData', JSON.stringify(updateData));

			const response = await fetch('?/update', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('แก้ไขแอดมินสำเร็จ');
				editDialogOpen = false;
				setTimeout(() => window.location.reload(), 500);
			} else {
				toast.error('เกิดข้อผิดพลาดในการแก้ไขแอดมิน');
			}
		} catch (error) {
			console.error('Update error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		}
	}

	async function handleToggleStatus(
		adminId: string,
		_userId: string,
		currentEnabledStatus: boolean
	) {
		const newStatus = !currentEnabledStatus;
		const actionText = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

		// Set loading state for this specific admin
		toggleLoading = { ...toggleLoading, [adminId]: true };

		try {
			const formData = new FormData();
			formData.append('adminId', adminId); // admin role id for the new endpoint
			formData.append('isActive', newStatus.toString()); // This gets converted to is_enabled in server

			const response = await fetch('?/toggleStatus', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(`${actionText}บัญชีแอดมินสำเร็จ`);
				// รีเฟรชข้อมูลทันทีเพื่อให้ UI อัพเดต
				setTimeout(() => window.location.reload(), 300);
			} else {
				toast.error(result.error || `เกิดข้อผิดพลาดในการ${actionText}บัญชีแอดมิน`);
			}
		} catch (error) {
			console.error('Toggle status error:', error);
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			// Clear loading state
			toggleLoading = { ...toggleLoading, [adminId]: false };
		}
	}

	// Function to get combined admin status for display
	function getAdminCombinedStatus(admin: AdminRole): {
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
			statusText = 'เปิดใช้งาน';
			badgeClass = 'bg-green-100 text-green-800 hover:bg-green-100';
			dotClass = 'bg-green-500';
		} else {
			statusText = 'เปิดใช้งาน';
			badgeClass = 'bg-green-50 text-green-700 hover:bg-green-50';
			dotClass = 'bg-green-400';
		}

		return {
			isEnabled,
			isActive,
			statusText,
			badgeClass,
			dotClass
		};
	}

	// Function to get account enabled status (for toggle button)
	function getAdminEnabledStatus(admin: AdminRole): boolean {
		// Check if admin account is enabled (can login)
		if ('is_enabled' in admin && admin.is_enabled !== undefined) {
			return Boolean(admin.is_enabled);
		}
		// Fallback to permissions check for backward compatibility
		return Boolean(admin.permissions && admin.permissions.length > 0);
	}

	// Group admins by level and faculty
	let groupedAdmins = $derived.by(() => {
		const admins = filteredAdmins;

		// Create a map to track unique admin IDs and filter duplicates silently
		const adminMap = new Map();
		const uniqueAdmins = admins.filter((admin) => {
			// Create a unique key using admin role ID and user ID
			const adminKey = `${admin.id}-${admin.user_id}`;

			// If already seen this admin, skip it
			if (adminMap.has(adminKey)) {
				return false;
			}

			adminMap.set(adminKey, admin);
			return true;
		});

		// Separate super admins
		const superAdmins = uniqueAdmins.filter((admin) => admin.admin_level === AdminLevel.SuperAdmin);

		// Group organization admins AND regular admins by organization
		const facultyAndRegularAdmins = uniqueAdmins.filter(
			(admin) =>
				admin.admin_level === AdminLevel.OrganizationAdmin ||
				admin.admin_level === AdminLevel.RegularAdmin
		);
		const facultyGroups: {
			[key: string]: { faculty: { id: string; name: string } | null; admins: AdminRole[] };
		} = {};

		facultyAndRegularAdmins.forEach((admin: any) => {
			const facultyId = admin.organization_id || 'unassigned';
			const facultyName =
				admin.organization?.name || getFacultyName(admin) || 'ไม่ได้มอบหมายหน่วยงาน';

			if (!facultyGroups[facultyId]) {
				facultyGroups[facultyId] = {
					faculty: admin.organization_id ? { id: admin.organization_id, name: facultyName } : null,
					admins: []
				};
			}
			facultyGroups[facultyId].admins.push(admin);
		});

		// Sort admins within each org group: OrganizationAdmin first, then RegularAdmin
		Object.values(facultyGroups).forEach((group) => {
			group.admins.sort((a, b) => {
				// OrganizationAdmin (0) comes before RegularAdmin (1)
				const orderA = a.admin_level === AdminLevel.OrganizationAdmin ? 0 : 1;
				const orderB = b.admin_level === AdminLevel.OrganizationAdmin ? 0 : 1;

				if (orderA !== orderB) {
					return orderA - orderB;
				}

				// If same admin level, sort by name
				const nameA = (a.user?.first_name || '') + ' ' + (a.user?.last_name || '');
				const nameB = (b.user?.first_name || '') + ' ' + (b.user?.last_name || '');
				return nameA.localeCompare(nameB, 'th');
			});
		});

		// No separate regular admins since they're now merged with faculty admins
		const regularAdmins: AdminRole[] = [];

		return {
			superAdmins,
			facultyGroups: Object.entries(facultyGroups).sort(([aKey, aGroup], [bKey, bGroup]) => {
				// Sort unassigned last, then by faculty name
				if (aKey === 'unassigned') return 1;
				if (bKey === 'unassigned') return -1;
				return (aGroup.faculty?.name || '').localeCompare(bGroup.faculty?.name || '');
			}),
			regularAdmins
		};
	});
</script>

<svelte:head>
	<title>จัดการแอดมิน - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0 space-y-1">
			<h1 class="admin-page-title"><IconShield class="size-6 text-primary" /> จัดการแอดมิน</h1>
			<p class="text-muted-foreground">
				จัดการผู้ดูแลระบบและกำหนดสิทธิ์การเข้าถึง แยกตามระดับและหน่วยงาน
			</p>
		</div>
		<Button onclick={openDialog} class="w-full gap-2 sm:w-auto">
			<IconPlus class="h-4 w-4" />
			เพิ่มแอดมิน
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">แอดมินทั้งหมด</CardTitle>
				<IconUsers class="h-4 w-4 flex-shrink-0 text-muted-foreground lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold lg:text-2xl">
					{groupedAdmins.superAdmins.length +
						groupedAdmins.facultyGroups.reduce((acc, [, group]) => acc + group.admins.length, 0)}
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">ซุปเปอร์แอดมิน</CardTitle>
				<IconShield class="h-4 w-4 flex-shrink-0 text-red-500 lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold text-red-600 lg:text-2xl">
					{groupedAdmins.superAdmins.length}
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm">แอดมินหน่วยงาน</CardTitle>
				<IconShield class="h-4 w-4 flex-shrink-0 text-blue-500 lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold text-blue-600 lg:text-2xl">
					{groupedAdmins.facultyGroups.reduce((acc, [, group]) => acc + group.admins.length, 0)}
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="truncate text-xs font-medium lg:text-sm"
					>แอดมินหน่วยงานและทั่วไป</CardTitle
				>
				<IconUsers class="h-4 w-4 flex-shrink-0 text-gray-500 lg:h-5 lg:w-5" />
			</CardHeader>
			<CardContent class="p-4 lg:p-6">
				<div class="text-lg font-bold text-gray-600 lg:text-2xl">
					{groupedAdmins.facultyGroups.reduce((acc, [, group]) => acc + group.admins.length, 0)}
				</div>
				<p class="text-xs text-muted-foreground">รวมแอดมินในหน่วยงานทั้งหมด</p>
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
						<Input bind:value={searchQuery} placeholder="ค้นหาชื่อแอดมิน อีเมล..." class="pl-10" />
					</div>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button
						variant={levelFilter === 'all' ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto"
						onclick={() => (levelFilter = 'all')}
					>
						ทั้งหมด
					</Button>
					<Button
						variant={levelFilter === AdminLevel.SuperAdmin ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto {levelFilter === AdminLevel.SuperAdmin
							? ''
							: 'border-red-600 text-red-600 hover:bg-red-50'}"
						onclick={() => (levelFilter = AdminLevel.SuperAdmin)}
					>
						ซุปเปอร์แอดมิน
					</Button>
					<Button
						variant={levelFilter === AdminLevel.OrganizationAdmin ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto {levelFilter === AdminLevel.OrganizationAdmin
							? ''
							: 'border-blue-600 text-blue-600 hover:bg-blue-50'}"
						onclick={() => (levelFilter = AdminLevel.OrganizationAdmin)}
					>
						แอดมินหน่วยงาน
					</Button>
					<Button
						variant={levelFilter === AdminLevel.RegularAdmin ? 'default' : 'outline'}
						size="sm"
						class="w-full sm:w-auto {levelFilter === AdminLevel.RegularAdmin
							? ''
							: 'border-gray-600 text-gray-600 hover:bg-gray-50'}"
						onclick={() => (levelFilter = AdminLevel.RegularAdmin)}
					>
						แอดมินทั่วไป
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Admin Groups -->
	<div class="space-y-8">
		{#if refreshing}
			<div class="flex items-center justify-center py-12">
				<IconLoader class="mr-3 h-8 w-8 animate-spin text-muted-foreground" />
				<span class="text-muted-foreground">กำลังรีเฟรชข้อมูล...</span>
			</div>
		{:else if filteredAdmins.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				{#if searchQuery || levelFilter !== 'all'}
					<IconSearch class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="mb-2 text-lg font-semibold">ไม่พบข้อมูลที่ตรงกับการค้นหา</h3>
					<p class="mb-4 text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่</p>
					<Button onclick={clearSearch} variant="outline">ล้างการค้นหา</Button>
				{:else}
					<IconShield class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="mb-2 text-lg font-semibold">ยังไม่มีแอดมินในระบบ</h3>
					<p class="mb-4 text-muted-foreground">เริ่มต้นด้วยการเพิ่มผู้ดูแลระบบคนแรก</p>
					<Button onclick={openDialog} class="gap-2">
						<IconPlus class="h-4 w-4" />
						เพิ่มแอดมินคนแรก
					</Button>
				{/if}
			</div>
		{:else}
			<!-- Super Admins Section -->
			{#if groupedAdmins.superAdmins.length > 0}
				<section aria-labelledby="super-admin-heading">
					<Card>
						<CardHeader class="bg-red-50/50">
							<CardTitle class="flex items-center gap-2">
								<IconShield class="h-5 w-5 text-red-600" />
								<span class="text-red-700">ซุปเปอร์แอดมิน</span>
								<Badge variant="destructive" class="ml-2">
									{groupedAdmins.superAdmins.length} คน
								</Badge>
							</CardTitle>
							<CardDescription class="mt-2 text-red-600">
								ผู้ดูแลระบบระดับสูงสุดที่มีสิทธิ์เข้าถึงและจัดการทุกส่วนของระบบ
							</CardDescription>
						</CardHeader>
						<CardContent class="p-0">
							<div class="overflow-x-auto">
								<Table.Root>
									<Table.Header>
										<Table.Row
											class="bg-gray-50 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-800"
										>
											<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
												>ชื่อ-นามสกุล</Table.Head
											>
											<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
												>อีเมล</Table.Head
											>
											<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
												>บทบาท</Table.Head
											>
											<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
												>สถานะ</Table.Head
											>
											<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
												>สิทธิ์</Table.Head
											>
											<Table.Head class="text-right font-semibold text-gray-900 dark:text-gray-100"
												>การดำเนินการ</Table.Head
											>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each groupedAdmins.superAdmins as admin (`super-${admin.id}-${admin.user_id}`)}
											<Table.Row class="hover:bg-red-50/50">
												<Table.Cell class="py-4 font-medium">
													<div class="flex items-center gap-3">
														<div
															class="flex h-8 w-8 items-center justify-center rounded-full bg-red-100"
														>
															<IconShield class="h-4 w-4 text-red-600" />
														</div>
														<span>
															{formatFullName(admin.user)}
														</span>
													</div>
												</Table.Cell>
												<Table.Cell class="py-4">
													<div class="flex items-center gap-2 text-muted-foreground">
														<IconMail class="h-4 w-4" />
														<span class="text-sm">{admin.user?.email || 'ไม่ระบุอีเมล'}</span>
													</div>
												</Table.Cell>
												<Table.Cell class="py-4">
													<Badge
														variant="destructive"
														class="bg-red-100 text-red-800 hover:bg-red-100"
													>
														{getRoleDisplayName(admin.admin_level)}
													</Badge>
												</Table.Cell>
												<Table.Cell class="py-4">
													{@const status = getAdminCombinedStatus(admin)}
													<Badge variant="default" class={status.badgeClass}>
														<span
															class="mr-2 h-2 w-2 rounded-full {status.dotClass}"
															aria-hidden="true"
														></span>
														{status.statusText}
													</Badge>
												</Table.Cell>
												<Table.Cell class="py-4">
													<div class="text-sm font-medium text-muted-foreground">
														{admin.permissions?.length || 0} สิทธิ์
													</div>
												</Table.Cell>
												<Table.Cell class="py-4 text-right">
													<div
														class="flex items-center justify-end gap-1"
														role="group"
														aria-label={`การดำเนินการสำหรับ ${formatFullName(admin.user)}`}
													>
														<Button
															variant="ghost"
															size="sm"
															onclick={() =>
																handleToggleStatus(
																	admin.id,
																	admin.user_id || admin.user?.id || '',
																	getAdminEnabledStatus(admin)
																)}
															disabled={toggleLoading[admin.id] || false}
															class="{getAdminEnabledStatus(admin)
																? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
																: 'text-green-600 hover:bg-green-50 hover:text-green-700'} transition-colors"
															aria-label={`${getAdminEnabledStatus(admin) ? 'ปิดการใช้งานบัญชี' : 'เปิดการใช้งานบัญชี'} ${formatFullName(admin.user)}`}
															title="{getAdminEnabledStatus(admin)
																? 'ปิดการใช้งานบัญชี'
																: 'เปิดการใช้งานบัญชี'}แอดมิน"
														>
															{#if toggleLoading[admin.id]}
																<IconLoader class="h-4 w-4 animate-spin" aria-hidden="true" />
															{:else if getAdminEnabledStatus(admin)}
																<IconToggleLeft class="h-4 w-4" aria-hidden="true" />
															{:else}
																<IconToggleRight class="h-4 w-4" aria-hidden="true" />
															{/if}
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onclick={() => openEditDialog(admin)}
															class="text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
															aria-label={`แก้ไข ${formatFullName(admin.user)}`}
															title="แก้ไขแอดมิน"
														>
															<IconEdit class="h-4 w-4" aria-hidden="true" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onclick={() =>
																openDeleteDialog(
																	admin.id,
																	admin.user_id || admin.user?.id || '',
																	formatFullName(admin.user)
																)}
															class="text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
															aria-label={`ลบ ${formatFullName(admin.user)}`}
															title="ลบแอดมิน"
														>
															<IconTrash class="h-4 w-4" aria-hidden="true" />
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
				</section>
			{/if}

			<!-- Faculty Admins Section -->
			{#if groupedAdmins.facultyGroups.length > 0}
				{#if groupedAdmins.superAdmins.length > 0}
					<div class="relative my-12">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span
								class="bg-white px-4 font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
								>แอดมินหน่วยงานและทั่วไป</span
							>
						</div>
					</div>
				{/if}

				<div class="space-y-6" role="region" aria-labelledby="faculty-admins-heading">
					<h2 id="faculty-admins-heading" class="sr-only">
						แอดมินหน่วยงานและทั่วไป จัดกลุ่มตามหน่วยงาน
					</h2>
					{#each groupedAdmins.facultyGroups as [facultyId, facultyGroup] (facultyId)}
						<Collapsible.Root open class="group">
							<Card class="border-blue-200 shadow-sm transition-shadow hover:shadow-md">
								<CardHeader class="bg-blue-50/50 pb-4 dark:bg-blue-950/20">
									<div class="flex items-center justify-between">
										<CardTitle class="flex items-center gap-3">
											<div class="flex items-center gap-3">
												<div
													class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900"
												>
													<IconShield
														class="h-5 w-5 text-blue-600 dark:text-blue-400"
														aria-hidden="true"
													/>
												</div>
												<div>
													<h3 class="text-lg font-bold text-blue-700 dark:text-blue-300">
														{facultyGroup.faculty?.name || 'ไม่ได้มอบหมายหน่วยงาน'}
													</h3>
													<div class="mt-1 flex items-center gap-2">
														<Badge
															variant="default"
															class="bg-blue-100 px-2 py-1 text-blue-800 hover:bg-blue-100"
														>
															{facultyGroup.admins.length} คน
														</Badge>
														{#if facultyGroup.faculty?.id}
															<span
																class="rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
															>
																ID: {facultyGroup.faculty.id.slice(-8)}
															</span>
														{/if}
													</div>
												</div>
											</div>
										</CardTitle>
										<Collapsible.Trigger
											class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 [&[data-state=open]>svg]:rotate-180"
											aria-label={facultyGroup.faculty?.name
												? `ขยาย/หดแอดมินหน่วยงาน${facultyGroup.faculty.name}`
												: 'ขยาย/หดแอดมินที่ไม่ได้มอบหมายหน่วยงาน'}
											title="คลิกเพื่อขยาย/หดรายการแอดมิน"
										>
											<IconChevronDown
												class="h-4 w-4 text-blue-600 transition-transform duration-200 dark:text-blue-400"
												aria-hidden="true"
											/>
										</Collapsible.Trigger>
									</div>
									<CardDescription class="mt-3 ml-13 text-blue-600 dark:text-blue-300">
										แอดมินหน่วยงานและแอดมินทั่วไป {facultyGroup.faculty?.name
											? `ที่มีสิทธิ์จัดการข้อมูลในหน่วยงาน${facultyGroup.faculty.name}`
											: 'ที่ยังไม่ได้รับมอบหมายหน่วยงานที่รับผิดชอบ'}
									</CardDescription>
								</CardHeader>
								<Collapsible.Content
									class="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
								>
									<CardContent class="p-0">
										<div class="overflow-x-auto border-t border-blue-100 dark:border-blue-800">
											<Table.Root>
												<Table.Header>
													<Table.Row
														class="bg-blue-25 hover:bg-blue-25 dark:bg-blue-950/10 dark:hover:bg-blue-950/10"
													>
														<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
															>ชื่อ-นามสกุล</Table.Head
														>
														<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
															>อีเมล</Table.Head
														>
														<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
															>บทบาท</Table.Head
														>
														<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
															>สถานะ</Table.Head
														>
														<Table.Head class="font-semibold text-gray-900 dark:text-gray-100"
															>สิทธิ์</Table.Head
														>
														<Table.Head
															class="text-right font-semibold text-gray-900 dark:text-gray-100"
															>การดำเนินการ</Table.Head
														>
													</Table.Row>
												</Table.Header>
												<Table.Body>
													{#each facultyGroup.admins as admin (`faculty-${facultyId}-${admin.id}-${admin.user_id}`)}
														<Table.Row
															class="transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-950/10"
														>
															<Table.Cell class="py-4 font-medium">
																<div class="flex items-center gap-3">
																	<div
																		class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
																	>
																		<IconUsers
																			class="h-4 w-4 text-blue-600 dark:text-blue-400"
																			aria-hidden="true"
																		/>
																	</div>
																	<span class="text-gray-900 dark:text-gray-100">
																		{formatFullName(admin.user)}
																	</span>
																</div>
															</Table.Cell>
															<Table.Cell class="py-4">
																<div
																	class="flex items-center gap-2 text-gray-600 dark:text-gray-300"
																>
																	<IconMail class="h-4 w-4 text-gray-400" aria-hidden="true" />
																	<span class="text-sm">{admin.user?.email || 'ไม่ระบุอีเมล'}</span>
																</div>
															</Table.Cell>
															<Table.Cell class="py-4">
																<Badge
																	variant="default"
																	class="bg-blue-100 text-blue-800 hover:bg-blue-100"
																>
																	{getRoleDisplayName(admin.admin_level)}
																</Badge>
															</Table.Cell>
															<Table.Cell class="py-4">
																{@const status = getAdminCombinedStatus(admin)}
																<Badge variant="default" class={status.badgeClass}>
																	<span
																		class="mr-2 h-2 w-2 rounded-full {status.dotClass}"
																		aria-hidden="true"
																	></span>
																	{status.statusText}
																</Badge>
															</Table.Cell>
															<Table.Cell class="py-4">
																<div class="text-sm font-medium text-gray-700 dark:text-gray-300">
																	{admin.permissions?.length || 0} สิทธิ์
																</div>
															</Table.Cell>
															<Table.Cell class="py-4 text-right">
																<div
																	class="flex items-center justify-end gap-1"
																	role="group"
																	aria-label="การดำเนินการสำหรับ {admin.user?.first_name ||
																		'ไม่ระบุชื่อ'}"
																>
																	<Button
																		variant="ghost"
																		size="sm"
																		onclick={() =>
																			handleToggleStatus(
																				admin.id,
																				admin.user_id || admin.user?.id || '',
																				getAdminEnabledStatus(admin)
																			)}
																		disabled={toggleLoading[admin.id] || false}
																		class="{getAdminEnabledStatus(admin)
																			? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
																			: 'text-green-600 hover:bg-green-50 hover:text-green-700'} transition-colors"
																		aria-label="{getAdminEnabledStatus(admin)
																			? 'ปิดการใช้งานบัญชี'
																			: 'เปิดการใช้งานบัญชี'} {admin.user?.first_name || 'แอดมิน'}"
																		title="{getAdminEnabledStatus(admin)
																			? 'ปิดการใช้งานบัญชี'
																			: 'เปิดการใช้งานบัญชี'}แอดมิน"
																	>
																		{#if toggleLoading[admin.id]}
																			<IconLoader class="h-4 w-4 animate-spin" aria-hidden="true" />
																		{:else if getAdminEnabledStatus(admin)}
																			<IconToggleLeft class="h-4 w-4" aria-hidden="true" />
																		{:else}
																			<IconToggleRight class="h-4 w-4" aria-hidden="true" />
																		{/if}
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onclick={() => openEditDialog(admin)}
																		class="text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
																		aria-label="แก้ไข {admin.user?.first_name || 'แอดมิน'}"
																		title="แก้ไขแอดมิน"
																	>
																		<IconEdit class="h-4 w-4" aria-hidden="true" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onclick={() =>
																			openDeleteDialog(
																				admin.id,
																				admin.user_id || admin.user?.id || '',
																				formatFullName(admin.user)
																			)}
																		class="text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
																		aria-label="ลบ {admin.user?.first_name || 'แอดมิน'}"
																		title="ลบแอดมิน"
																	>
																		<IconTrash class="h-4 w-4" aria-hidden="true" />
																	</Button>
																</div>
															</Table.Cell>
														</Table.Row>
													{/each}
												</Table.Body>
											</Table.Root>
										</div>
									</CardContent>
								</Collapsible.Content>
							</Card>
						</Collapsible.Root>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Create Admin Dialog -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>เพิ่มแอดมินใหม่</Dialog.Title>
			<Dialog.Description>กรอกข้อมูลเพื่อสร้างผู้ดูแลระบบใหม่</Dialog.Description>
		</Dialog.Header>

		<form class="space-y-3 px-1 sm:space-y-4 sm:px-0" onsubmit={(e) => { e.preventDefault(); handleCreateSubmit(); }}>

			<div class="space-y-2">
				<Label>คำนำหน้า</Label>
				<Select.Root type="single" bind:value={selectedPrefix} disabled={submitting}>
					<Select.Trigger>
						{PrefixOptions.find((opt) => opt.value === selectedPrefix)?.label ?? 'เลือกคำนำหน้า'}
					</Select.Trigger>
					<Select.Content>
						{#each PrefixOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
				<div class="space-y-2">
					<Label>ชื่อจริง</Label>
					<Input bind:value={formData.first_name} placeholder="กรอกชื่อจริง" disabled={submitting} />
				</div>
				<div class="space-y-2">
					<Label>นามสกุล</Label>
					<Input bind:value={formData.last_name} placeholder="กรอกนามสกุล" disabled={submitting} />
				</div>
			</div>

			<div class="space-y-2">
				<Label>อีเมล</Label>
				<Input type="email" bind:value={formData.email} placeholder="admin@example.com" disabled={submitting} />
			</div>

			<div class="space-y-2">
				<Label>รหัสผ่าน</Label>
				<Input type="password" bind:value={formData.password} placeholder="กรุณาใส่รหัสผ่าน" disabled={submitting} />
				<div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
					รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร ประกอบด้วยตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข
				</div>
			</div>

			<div class="space-y-2">
				<Label>ระดับแอดมิน</Label>
				<Select.Root type="single" bind:value={selectedAdminLevel} disabled={submitting}>
					<Select.Trigger>
						{adminLevelOptions.find((opt) => opt.value === selectedAdminLevel)?.label ?? 'เลือกระดับแอดมิน'}
					</Select.Trigger>
					<Select.Content>
						{#each adminLevelOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if selectedAdminLevel === AdminLevel.OrganizationAdmin}
				<div class="space-y-2">
					<Label>หน่วยงาน <span class="text-red-500">*</span></Label>
					<Select.Root type="single" bind:value={selectedFaculty} disabled={submitting}>
						<Select.Trigger class={!selectedFaculty ? 'border-red-300' : ''}>
							{facultyOptions.find((opt) => opt.value === selectedFaculty)?.label ?? 'เลือกหน่วยงานที่รับผิดชอบ'}
						</Select.Trigger>
						<Select.Content>
							{#each facultyOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if !selectedFaculty}
						<p class="mt-1 text-sm text-red-600">กรุณาเลือกหน่วยงานสำหรับแอดมินระดับหน่วยงาน</p>
					{/if}
				</div>
			{:else if selectedAdminLevel === AdminLevel.SuperAdmin}
				<div class="rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
					<div class="flex items-center">
						<IconShield class="mr-2 h-5 w-5 text-blue-500" />
						<p class="text-sm text-blue-700 dark:text-blue-300">ซุปเปอร์แอดมินมีสิทธิ์เข้าถึงทุกหน่วยงาน ไม่จำเป็นต้องระบุหน่วยงานเฉพาะ</p>
					</div>
				</div>
			{:else if selectedAdminLevel === AdminLevel.RegularAdmin}
				<div class="rounded-md bg-gray-50 p-3 dark:bg-gray-800/50">
					<div class="flex items-center">
						<IconUsers class="mr-2 h-5 w-5 text-gray-500" />
						<p class="text-sm text-gray-600 dark:text-gray-300">แอดมินทั่วไปจะได้รับสิทธิ์พื้นฐานในการจัดการระบบ</p>
					</div>
				</div>
			{/if}

			<Dialog.Footer class="flex flex-col gap-2 sm:flex-row sm:gap-4">
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)} class="order-2 sm:order-1">ยกเลิก</Button>
				<Button
					type="submit"
					disabled={submitting || (selectedAdminLevel === AdminLevel.OrganizationAdmin && !selectedFaculty)}
					class="order-1 sm:order-2"
				>
					{#if submitting}
						<IconLoader class="mr-2 h-4 w-4 animate-spin" />
						กำลังสร้าง...
					{:else}
						สร้างแอดมิน
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Admin Dialog -->
<Dialog.Root bind:open={editDialogOpen}>
	<Dialog.Content class="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>แก้ไขแอดมิน</Dialog.Title>
			<Dialog.Description>แก้ไขข้อมูลและสิทธิ์ของแอดมิน</Dialog.Description>
		</Dialog.Header>

		{#if editingAdmin && editingAdmin.user}
			<div class="space-y-3 px-1 sm:space-y-4 sm:px-0">
				<div class="space-y-2">
					<Label>คำนำหน้า</Label>
					<Select.Root type="single" bind:value={editSelectedPrefix}>
						<Select.Trigger>
							{PrefixOptions.find((opt) => opt.value === editSelectedPrefix)?.label ??
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
				</div>

				<div class="space-y-2">
					<Label>ชื่อ-นามสกุล</Label>
					<Input bind:value={editingAdmin.user.first_name} placeholder="ชื่อ" class="mb-2" />
					<Input bind:value={editingAdmin.user.last_name} placeholder="นามสกุล" />
				</div>

				<div class="space-y-2">
					<Label>อีเมล</Label>
					<Input
						type="email"
						bind:value={editingAdmin.user.email}
						placeholder="admin@example.com"
					/>
				</div>

				<div class="space-y-2">
					<Label>ระดับแอดมิน</Label>
					<Select.Root type="single" bind:value={editSelectedAdminLevel}>
						<Select.Trigger>
							{adminLevelOptions.find((opt) => opt.value === editSelectedAdminLevel)?.label ??
								'เลือกระดับแอดมิน'}
						</Select.Trigger>
						<Select.Content>
							{#each adminLevelOptions as option}
								<Select.Item value={option.value}>
									{option.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				{#if editSelectedAdminLevel === AdminLevel.OrganizationAdmin}
					<div class="space-y-2">
						<Label>หน่วยงาน</Label>
						<Select.Root type="single" bind:value={editSelectedFaculty}>
							<Select.Trigger>
								{facultyOptions.find((opt) => opt.value === editSelectedFaculty)?.label ??
									'เลือกหน่วยงาน'}
							</Select.Trigger>
							<Select.Content>
								{#each facultyOptions as option}
									<Select.Item value={option.value}>
										{option.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}

				<Dialog.Footer class="flex flex-col gap-2 sm:flex-row sm:gap-4">
					<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)} class="order-2 sm:order-1">
						ยกเลิก
					</Button>
					<Button
						type="button"
						onclick={() => {
							if (editingAdmin && editingAdmin.user && editSelectedAdminLevel) {
								handleUpdate(editingAdmin.id, editingAdmin.user_id || editingAdmin.user.id, {
									prefix: editSelectedPrefix,
									first_name: editingAdmin.user.first_name,
									last_name: editingAdmin.user.last_name,
									email: editingAdmin.user.email,
									admin_level: editSelectedAdminLevel,
									organization_id: editSelectedFaculty,
									permissions: editingAdmin.permissions || []
								});
							}
						}}
						class="order-1 sm:order-2"
					>
						บันทึกการแก้ไข
					</Button>
				</Dialog.Footer>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Admin Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>ยืนยันการลบแอดมิน</AlertDialog.Title>
			<AlertDialog.Description>
				{#if adminToDelete}
					คุณแน่ใจหรือไม่ที่จะลบแอดมิน "{adminToDelete.name}"?<br />
					การดำเนินการนี้ไม่สามารถยกเลิกได้ และจะลบข้อมูลของแอดมินออกจากระบบถาวร
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
				ลบแอดมิน
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
