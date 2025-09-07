<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import {
		IconUsers,
		IconUserCheck,
		IconUserX,
		IconSearch,
		IconDownload,
		IconRefresh,
		IconUserPlus
	} from '@tabler/icons-svelte/icons';
	import { getRoleText, getRoleBadgeVariant } from '$lib/utils';

	let { data } = $props();

	// Extract data with safe defaults
	const {
		users = [],
		stats = {
			total_users: 0,
			active_users: 0,
			inactive_users: 0,
			students: 0,
			faculty: 0,
			staff: 0,
			recent_registrations: 0
		},
		organizations = [],
		filters = {},
		pagination = { page: 1, limit: 20, total_count: 0, total_pages: 1 },
		canManageAllUsers = false,
		adminLevel
	} = $derived(data || {});

	// Filter states
	let searchTerm = $state('');
	let selectedRole = $state('all');
	let selectedStatus = $state('all');
	let selectedOrg = $state('all');

	// Filtered users
	let filteredUsers = $derived(
		users.filter((user) => {
			const matchesSearch =
				searchTerm === '' ||
				user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.student_id?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesRole = selectedRole === 'all' || user.role === selectedRole;
			const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
			const matchesOrg = selectedOrg === 'all' || user.organization?.id === selectedOrg;

			return matchesSearch && matchesRole && matchesStatus && matchesOrg;
		})
	);

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
		if (status === 'active') return 'default';
		if (status === 'suspended') return 'destructive';
		return 'secondary';
	}

	function getStatusText(status: string): string {
		if (status === 'active') return 'ใช้งานอยู่';
		if (status === 'suspended') return 'ถูกระงับ';
		return 'ไม่ใช้งาน';
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('th-TH', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>จัดการผู้ใช้ - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="admin-page-title"><IconUsers class="size-6 text-primary" /> จัดการผู้ใช้</h1>
			<p class="text-sm text-muted-foreground">จัดการผู้ใช้งานในระบบ</p>
		</div>
		<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
			<Button variant="outline" size="sm" class="w-full sm:w-auto">
				<IconDownload class="mr-2 h-4 w-4" />
				ส่งออกข้อมูล
			</Button>
			<Button variant="outline" size="sm" class="w-full sm:w-auto">
				<IconRefresh class="mr-2 h-4 w-4" />
				รีเฟรช
			</Button>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">ผู้ใช้ทั้งหมด</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.total_users}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 lg:h-10 lg:w-10"
					>
						<IconUsers class="h-4 w-4 text-primary lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">ใช้งานอยู่</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.active_users}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-500/10 lg:h-10 lg:w-10"
					>
						<IconUserCheck class="h-4 w-4 text-green-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">ไม่ใช้งาน</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.inactive_users}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 lg:h-10 lg:w-10"
					>
						<IconUserX class="h-4 w-4 text-red-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">นักศึกษา</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.students}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 lg:h-10 lg:w-10"
					>
						<IconUserPlus class="h-4 w-4 text-blue-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="p-4">
			<div class="space-y-4 sm:flex sm:flex-row sm:gap-4 sm:space-y-0">
				<!-- Search -->
				<div class="flex-1">
					<div class="relative">
						<IconSearch
							class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground"
						/>
						<Input
							bind:value={searchTerm}
							placeholder="ค้นหาชื่อ, อีเมล, หรือรหัสนักศึกษา..."
							class="pl-10"
						/>
					</div>
				</div>

				<!-- Filters -->
				<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
					<!-- Role Filter -->
					<Select.Root type="single" bind:value={selectedRole}>
						<Select.Trigger class="w-full sm:w-48">
							{selectedRole === 'all'
								? 'ทุกบทบาท'
								: selectedRole === 'student'
									? 'นักศึกษา'
									: selectedRole === 'faculty'
										? 'อาจารย์'
										: 'เจ้าหน้าที่'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกบทบาท</Select.Item>
							<Select.Item value="student">นักศึกษา</Select.Item>
							<Select.Item value="faculty">อาจารย์</Select.Item>
							<Select.Item value="staff">เจ้าหน้าที่</Select.Item>
						</Select.Content>
					</Select.Root>

					<!-- Status Filter -->
					<Select.Root type="single" bind:value={selectedStatus}>
						<Select.Trigger class="w-full sm:w-48">
							{selectedStatus === 'all'
								? 'ทุกสถานะ'
								: selectedStatus === 'active'
									? 'ใช้งานอยู่'
									: selectedStatus === 'suspended'
										? 'ถูกระงับ'
										: 'ไม่ใช้งาน'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกสถานะ</Select.Item>
							<Select.Item value="active">ใช้งานอยู่</Select.Item>
							<Select.Item value="inactive">ไม่ใช้งาน</Select.Item>
							<Select.Item value="suspended">ถูกระงับ</Select.Item>
						</Select.Content>
					</Select.Root>

					{#if canManageAllUsers && organizations.length > 0}
						<!-- Organization Filter -->
						<Select.Root type="single" bind:value={selectedOrg}>
							<Select.Trigger class="w-full sm:w-48">
								{selectedOrg === 'all'
									? 'ทุกหน่วยงาน'
									: (organizations.find((o) => o.id === selectedOrg)?.name ?? 'หน่วยงาน')}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="all">ทุกหน่วยงาน</Select.Item>
								{#each organizations as org}
									<Select.Item value={org.id}>{org.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Users Table -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<span>รายการผู้ใช้</span>
				<span class="text-sm font-normal text-muted-foreground">
					แสดง {filteredUsers.length} จาก {stats.total_users} ผู้ใช้
				</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="p-0">
			{#if filteredUsers.length > 0}
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>ผู้ใช้</Table.Head>
								<Table.Head>บทบาท</Table.Head>
								<Table.Head>หน่วยงาน</Table.Head>
								<Table.Head>สถานะ</Table.Head>
								<Table.Head>วันที่สมัคร</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each filteredUsers as user}
								<Table.Row class="hover:bg-muted/50">
									<Table.Cell>
										<div class="min-w-0 space-y-1">
											<div class="flex items-center gap-3">
												<div
													class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"
												>
													<span class="text-sm font-medium text-primary">
														{user.first_name?.charAt(0)?.toUpperCase() || 'U'}
													</span>
												</div>
												<div class="min-w-0 flex-1">
													<p class="truncate font-medium text-foreground">
														{user.first_name}
														{user.last_name}
													</p>
													<p class="truncate text-sm text-muted-foreground">{user.email}</p>
													{#if user.student_id}
														<p class="truncate text-xs text-muted-foreground">
															รหัส: {user.student_id}
														</p>
													{/if}
												</div>
											</div>
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant={getRoleBadgeVariant(user.role)}>
											{getRoleText(user.role)}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										{#if user.organization}
											<div class="min-w-0 space-y-1">
												<p class="truncate text-sm font-medium">{user.organization.name}</p>
												{#if user.department}
													<p class="truncate text-xs text-muted-foreground">
														{user.department.name}
													</p>
												{/if}
											</div>
										{:else}
											<span class="text-sm text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={getStatusBadgeVariant(user.status)}>
											{getStatusText(user.status)}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<span class="text-sm">{formatDate(user.created_at)}</span>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{:else}
				<div class="py-12 text-center">
					<IconUsers class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-medium">ไม่พบผู้ใช้</h3>
					<p class="mb-4 text-muted-foreground">
						{searchTerm ||
						selectedRole !== 'all' ||
						selectedStatus !== 'all' ||
						selectedOrg !== 'all'
							? 'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา'
							: 'ยังไม่มีผู้ใช้ในระบบ'}
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Pagination -->
	{#if pagination.total_pages > 1}
		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-muted-foreground">
						แสดง {(pagination.page - 1) * pagination.limit + 1} ถึง
						{Math.min(pagination.page * pagination.limit, pagination.total_count)}
						จาก {pagination.total_count} รายการ
					</p>
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page <= 1}
							onclick={() => goto(`?page=${pagination.page - 1}`)}
						>
							ก่อนหน้า
						</Button>
						<span class="text-sm font-medium">
							หน้า {pagination.page} จาก {pagination.total_pages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page >= pagination.total_pages}
							onclick={() => goto(`?page=${pagination.page + 1}`)}
						>
							ถัดไป
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
