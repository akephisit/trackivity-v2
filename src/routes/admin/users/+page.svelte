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
		IconEdit,
		IconEye,
		IconUserPlus
	} from '@tabler/icons-svelte/icons';
	import { getRoleText, getRoleBadgeVariant } from '$lib/utils';
	import { goto } from '$app/navigation';

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
			const matchesSearch = searchTerm === '' || 
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
		if (status === 'online') return 'default';
		if (status === 'disabled') return 'destructive';
		return 'secondary';
	}

	function getStatusText(status: string): string {
		if (status === 'online') return 'ใช้งานอยู่';
		if (status === 'disabled') return 'ถูกระงับ';
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
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
			<Button variant="outline" size="sm" class="w-full sm:w-auto">
				<IconDownload class="w-4 h-4 mr-2" />
				ส่งออกข้อมูล
			</Button>
			<Button variant="outline" size="sm" class="w-full sm:w-auto">
				<IconRefresh class="w-4 h-4 mr-2" />
				รีเฟรช
			</Button>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">ผู้ใช้ทั้งหมด</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.total_users}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUsers class="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">ใช้งานอยู่</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.active_users}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUserCheck class="w-4 h-4 lg:w-5 lg:h-5 text-green-500" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">ไม่ใช้งาน</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.inactive_users}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUserX class="w-4 h-4 lg:w-5 lg:h-5 text-red-500" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">นักศึกษา</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.students}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUserPlus class="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="p-4">
			<div class="space-y-4 sm:space-y-0 sm:flex sm:flex-row sm:gap-4">
				<!-- Search -->
				<div class="flex-1">
					<div class="relative">
						<IconSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							bind:value={searchTerm}
							placeholder="ค้นหาชื่อ, อีเมล, หรือรหัสนักศึกษา..."
							class="pl-10"
						/>
					</div>
				</div>

				<!-- Filters -->
				<div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
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
								: selectedStatus === 'online'
								? 'ใช้งานอยู่'
								: selectedStatus === 'disabled'
								? 'ถูกระงับ'
								: 'ไม่ใช้งาน'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกสถานะ</Select.Item>
							<Select.Item value="online">ใช้งานอยู่</Select.Item>
							<Select.Item value="offline">ไม่ใช้งาน</Select.Item>
							<Select.Item value="disabled">ถูกระงับ</Select.Item>
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
							<Table.Head class="text-right">จัดการ</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredUsers as user}
							<Table.Row class="hover:bg-muted/50">
								<Table.Cell>
									<div class="space-y-1 min-w-0">
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
												<span class="text-sm font-medium text-primary">
													{user.first_name?.charAt(0)?.toUpperCase() || 'U'}
												</span>
											</div>
											<div class="min-w-0 flex-1">
												<p class="font-medium text-foreground truncate">
													{user.first_name} {user.last_name}
												</p>
												<p class="text-sm text-muted-foreground truncate">{user.email}</p>
												{#if user.student_id}
													<p class="text-xs text-muted-foreground truncate">รหัส: {user.student_id}</p>
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
										<div class="space-y-1 min-w-0">
											<p class="text-sm font-medium truncate">{user.organization.name}</p>
											{#if user.department}
												<p class="text-xs text-muted-foreground truncate">{user.department.name}</p>
											{/if}
										</div>
									{:else}
										<span class="text-muted-foreground text-sm">-</span>
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
								<Table.Cell class="text-right">
									<div class="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => goto(`/admin/users/${user.id}`)}
										>
											<IconEye class="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => goto(`/admin/users/${user.id}/edit`)}
										>
											<IconEdit class="w-4 h-4" />
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
					</Table.Root>
				</div>
			{:else}
				<div class="text-center py-12">
					<IconUsers class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
					<h3 class="text-lg font-medium mb-2">ไม่พบผู้ใช้</h3>
					<p class="text-muted-foreground mb-4">
						{searchTerm || selectedRole !== 'all' || selectedStatus !== 'all' || selectedOrg !== 'all'
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
						แสดง {((pagination.page - 1) * pagination.limit) + 1} ถึง 
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
