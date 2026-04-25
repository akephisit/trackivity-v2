<script lang="ts">
	import { CircleAlert, RefreshCw, Search, UserCheck, UserX, Users } from '@lucide/svelte';
	import { usersApi, organizationsApi, adminApi, ApiError } from '$lib/api';
	import type { UserListItem, Organization, DashboardStats } from '$lib/api';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { goto } from '$app/navigation';

	// We pull up to 200 users per page from the backend, which is its
	// hard cap. If totalUsers exceeds this we surface a warning so admins
	// know they need to narrow with search/status before making decisions
	// based on the visible data.
	const PER_PAGE = 200;

	// ─── State ──────────────────────────────────────────────────────────────
	let users = $state<UserListItem[]>([]);
	let totalUsers = $state(0);
	let stats = $state<DashboardStats | null>(null);
	let organizations = $state<Organization[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let searchTerm = $state('');
	let selectedStatus = $state('all');
	let selectedOrg = $state('all');

	const isSuperAdmin = $derived(authStore.user?.admin_role?.admin_level === 'super_admin');

	// ─── Derived ────────────────────────────────────────────────────────────
	let filteredUsers = $derived(
		users.filter((user) => {
			const q = searchTerm.toLowerCase();
			const matchesSearch =
				q === '' ||
				user.first_name?.toLowerCase().includes(q) ||
				user.last_name?.toLowerCase().includes(q) ||
				user.email?.toLowerCase().includes(q) ||
				user.student_id?.toLowerCase().includes(q);

			const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
			const matchesOrg = selectedOrg === 'all' || user.organization_name === selectedOrg;

			return matchesSearch && matchesStatus && matchesOrg;
		})
	);

	const usersTruncated = $derived(totalUsers > users.length);

	// ─── Data Fetching ──────────────────────────────────────────────────────
	async function fetchData() {
		loading = true;
		error = null;
		try {
			const [userResult, orgData, dashStats] = await Promise.all([
				usersApi.list({ per_page: PER_PAGE }),
				organizationsApi.listAdmin().catch(() => [] as Organization[]),
				adminApi.dashboardStats().catch(() => null)
			]);
			users = userResult.users;
			totalUsers = userResult.total;
			organizations = orgData;
			stats = dashStats;
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลได้';
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active': return 'default';
			case 'inactive': return 'secondary';
			case 'suspended': return 'destructive';
			default: return 'outline';
		}
	}

	function getStatusText(status: string): string {
		const map: Record<string, string> = {
			active: 'เปิดใช้งาน',
			inactive: 'ปิดใช้งาน',
			suspended: 'ระงับ',
		};
		return map[status] || status;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('th-TH', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>จัดการผู้ใช้ - Trackivity Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">จัดการผู้ใช้</h1>
			<p class="text-muted-foreground">รายชื่อผู้ใช้งานทั้งหมดในระบบ</p>
		</div>
		<Button variant="outline" onclick={fetchData} disabled={loading}>
			<RefreshCw class="mr-2 size-4 {loading ? 'animate-spin' : ''}" />
			รีเฟรช
		</Button>
	</div>

	<!-- Stats — backed by /admin/dashboard-stats so they stay accurate
	     past the 200-user page cap and respect the admin's org scope. -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<Users class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">
						{loading ? '--' : (stats?.users_total ?? totalUsers).toLocaleString()}
					</p>
					<p class="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<UserCheck class="size-8 text-green-600" />
				<div>
					<p class="text-2xl font-bold">
						{loading ? '--' : (stats?.users_active ?? 0).toLocaleString()}
					</p>
					<p class="text-sm text-muted-foreground">เปิดใช้งาน</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<UserX class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">
						{loading
							? '--'
							: Math.max(
									0,
									(stats?.users_total ?? totalUsers) - (stats?.users_active ?? 0)
								).toLocaleString()}
					</p>
					<p class="text-sm text-muted-foreground">ไม่ใช้งาน</p>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters + Table -->
	<Card>
		<CardHeader>
			<div class="flex flex-col gap-3 sm:flex-row">
				<div class="relative flex-1">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input bind:value={searchTerm} placeholder="ค้นหาผู้ใช้..." class="pl-9" />
				</div>
				<Select.Root type="single" bind:value={selectedStatus}>
					<Select.Trigger class="sm:w-40">
						{#if selectedStatus === 'active'}เปิดใช้งาน
						{:else if selectedStatus === 'inactive'}ปิดใช้งาน
						{:else if selectedStatus === 'suspended'}ระงับ
						{:else}สถานะทั้งหมด
						{/if}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">สถานะทั้งหมด</Select.Item>
						<Select.Item value="active">เปิดใช้งาน</Select.Item>
						<Select.Item value="inactive">ปิดใช้งาน</Select.Item>
						<Select.Item value="suspended">ระงับ</Select.Item>
					</Select.Content>
				</Select.Root>
				{#if isSuperAdmin}
					<Select.Root type="single" bind:value={selectedOrg}>
						<Select.Trigger class="sm:w-48">
							{selectedOrg === 'all' ? 'หน่วยงานทั้งหมด' : selectedOrg}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">หน่วยงานทั้งหมด</Select.Item>
							{#each organizations as org}
								<Select.Item value={org.name}>{org.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				{@const cols = isSuperAdmin ? 6 : 5}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ผู้ใช้</Table.Head>
							<Table.Head>รหัสนักศึกษา</Table.Head>
							{#if isSuperAdmin}
								<Table.Head>หน่วยงาน</Table.Head>
							{/if}
							<Table.Head>ภาควิชา</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head>เข้าสู่ระบบล่าสุด</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each Array(6) as _}
							<Table.Row>
								{#each Array(cols) as _}
									<Table.Cell><Skeleton class="h-4 w-full" /></Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else if error}
				<Alert variant="destructive">
					<CircleAlert class="size-4" />
					<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<span>{error}</span>
						<Button size="sm" variant="outline" onclick={fetchData}>
							<RefreshCw class="mr-2 size-4" />ลองใหม่
						</Button>
					</AlertDescription>
				</Alert>
			{:else if filteredUsers.length === 0}
				<div class="py-12 text-center">
					<Users class="mx-auto mb-4 size-12 text-muted-foreground/50" />
					<p class="text-muted-foreground">ไม่พบผู้ใช้</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ผู้ใช้</Table.Head>
							<Table.Head>รหัสนักศึกษา</Table.Head>
							{#if isSuperAdmin}
								<Table.Head>หน่วยงาน</Table.Head>
							{/if}
							<Table.Head>ภาควิชา</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head>เข้าสู่ระบบล่าสุด</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredUsers as user}
							<Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/admin/users/${user.id}`)}>
								<Table.Cell>
									<div>
										<p class="font-medium">{user.prefix} {user.first_name} {user.last_name}</p>
										<p class="text-xs text-muted-foreground">{user.email}</p>
									</div>
								</Table.Cell>
								<Table.Cell>
									<code class="text-sm">{user.student_id}</code>
								</Table.Cell>
								{#if isSuperAdmin}
									<Table.Cell>
										<span class="text-sm">{user.organization_name ?? '-'}</span>
									</Table.Cell>
								{/if}
								<Table.Cell>
									<span class="text-sm">{user.department_name ?? '-'}</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getStatusBadgeVariant(user.status)}>
										{getStatusText(user.status)}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<span class="text-sm text-muted-foreground">{formatDate(user.last_login_at)}</span>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				<div class="mt-4 space-y-2">
					<p class="text-center text-sm text-muted-foreground">
						แสดง {filteredUsers.length.toLocaleString()} จากทั้งหมด {totalUsers.toLocaleString()} คน
					</p>
					{#if usersTruncated}
						<Alert>
							<CircleAlert class="size-4" />
							<AlertDescription>
								โหลดมาแล้ว {users.length.toLocaleString()} คนแรกจากทั้งหมด {totalUsers.toLocaleString()} คน —
								ใช้ตัวกรองเพื่อค้นหาคนที่ต้องการให้แม่นยำขึ้น
							</AlertDescription>
						</Alert>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
