<script lang="ts">
	import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw, Search, UserCheck, UserX, Users } from '@lucide/svelte';
	import { adminApi, usersApi, ApiError } from '$lib/api';
	import type { DashboardStats, UserListItem } from '$lib/api';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Table from '$lib/components/ui/table';

	const PER_PAGE = 50;

	// ─── State ──────────────────────────────────────────────────────────────
	let users = $state<UserListItem[]>([]);
	let totalUsers = $state(0);
	let stats = $state<DashboardStats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let searchInput = $state('');
	let searchTerm = $state(''); // debounced
	let selectedStatus = $state('all');
	let currentPage = $state(1);

	const totalPages = $derived(Math.max(1, Math.ceil(totalUsers / PER_PAGE)));
	const inactiveCount = $derived(
		Math.max(0, (stats?.users_total ?? totalUsers) - (stats?.users_active ?? 0))
	);

	// ─── Search debounce ─────────────────────────────────────────────────────
	let searchDebouncer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const next = searchInput;
		if (searchDebouncer) clearTimeout(searchDebouncer);
		searchDebouncer = setTimeout(() => {
			searchTerm = next;
		}, 300);
		return () => {
			if (searchDebouncer) clearTimeout(searchDebouncer);
		};
	});

	// Refetch on filter change; reset page when filters change.
	$effect(() => {
		searchTerm;
		selectedStatus;
		untrack(() => {
			if (currentPage !== 1) currentPage = 1;
		});
		fetchUsers();
	});

	$effect(() => {
		currentPage;
		fetchUsers();
	});

	// ─── Data Fetching ──────────────────────────────────────────────────────
	async function fetchUsers() {
		loading = true;
		error = null;
		try {
			const result = await usersApi.list({
				page: currentPage,
				per_page: PER_PAGE,
				search: searchTerm || undefined,
				status: selectedStatus
			});
			users = result.users ?? [];
			totalUsers = result.total ?? 0;
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้';
		} finally {
			loading = false;
		}
	}

	async function fetchStats() {
		try {
			stats = await adminApi.dashboardStats();
		} catch {
			// Non-critical — UI falls back to totalUsers from the list response.
		}
	}

	async function refreshAll() {
		await Promise.all([fetchUsers(), fetchStats()]);
	}

	function gotoPage(p: number) {
		const next = Math.min(Math.max(1, p), totalPages);
		if (next !== currentPage) currentPage = next;
	}

	// ─── Display helpers ─────────────────────────────────────────────────────
	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			case 'suspended':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getStatusText(status: string): string {
		const map: Record<string, string> = {
			active: 'เปิดใช้งาน',
			inactive: 'ปิดใช้งาน',
			suspended: 'ระงับ'
		};
		return map[status] || status;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(fetchStats);
</script>

<svelte:head>
	<title>จัดการผู้ใช้หน่วยงาน - Trackivity</title>
	<meta name="description" content="จัดการผู้ใช้ในระบบ" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="admin-page-title">
				<Users class="size-6 text-primary" />
				จัดการผู้ใช้หน่วยงาน
			</h1>
			<p class="text-muted-foreground">จัดการข้อมูลผู้ใช้ในหน่วยงานของคุณ</p>
		</div>
		<Button variant="outline" onclick={refreshAll} disabled={loading}>
			<RefreshCw class="mr-2 h-4 w-4 {loading ? 'animate-spin' : ''}" />
			รีเฟรช
		</Button>
	</div>

	<!-- Stats — backed by /admin/dashboard-stats so they reflect the
	     full dataset, not just the current paginated page. -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle>
				<Users class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading ? '--' : (stats?.users_total ?? totalUsers).toLocaleString()}
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">เปิดใช้งาน</CardTitle>
				<UserCheck class="h-4 w-4 text-green-600" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading ? '--' : (stats?.users_active ?? 0).toLocaleString()}
				</div>
				{#if stats && stats.users_total > 0}
					<p class="text-xs text-muted-foreground">
						{((stats.users_active / stats.users_total) * 100).toFixed(1)}% ของผู้ใช้ทั้งหมด
					</p>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ไม่ใช้งาน</CardTitle>
				<UserX class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loading ? '--' : inactiveCount.toLocaleString()}
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
					<Input
						bind:value={searchInput}
						placeholder="ค้นหา ชื่อ / อีเมล / รหัสนักศึกษา..."
						class="pl-9"
					/>
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
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ผู้ใช้</Table.Head>
							<Table.Head>รหัสนักศึกษา</Table.Head>
							<Table.Head>ภาควิชา</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head>เข้าสู่ระบบล่าสุด</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each Array(6) as _}
							<Table.Row>
								{#each Array(5) as _}
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
						<Button size="sm" variant="outline" onclick={fetchUsers}>
							<RefreshCw class="mr-2 size-4" />ลองใหม่
						</Button>
					</AlertDescription>
				</Alert>
			{:else if users.length === 0}
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
							<Table.Head>ภาควิชา</Table.Head>
							<Table.Head>สถานะ</Table.Head>
							<Table.Head>เข้าสู่ระบบล่าสุด</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each users as user}
							<Table.Row
								class="cursor-pointer hover:bg-muted/50"
								onclick={() => goto(`/admin/users/${user.id}`)}
							>
								<Table.Cell>
									<div>
										<p class="font-medium">
											{user.prefix}
											{user.first_name}
											{user.last_name}
										</p>
										<p class="text-xs text-muted-foreground">{user.email}</p>
									</div>
								</Table.Cell>
								<Table.Cell>
									<code class="text-sm">{user.student_id}</code>
								</Table.Cell>
								<Table.Cell>
									<span class="text-sm">{user.department_name ?? '-'}</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getStatusBadgeVariant(user.status)}>
										{getStatusText(user.status)}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<span class="text-sm text-muted-foreground"
										>{formatDate(user.last_login_at)}</span
									>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>

				<!-- Pagination footer -->
				<div class="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
					<p class="text-sm text-muted-foreground">
						{#if totalUsers === 0}
							ไม่มีผู้ใช้
						{:else}
							{@const from = (currentPage - 1) * PER_PAGE + 1}
							{@const to = Math.min(currentPage * PER_PAGE, totalUsers)}
							แสดง {from.toLocaleString()}–{to.toLocaleString()} จาก {totalUsers.toLocaleString()} คน
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => gotoPage(currentPage - 1)}
							disabled={currentPage <= 1 || loading}
						>
							<ChevronLeft class="size-4" />
							ก่อนหน้า
						</Button>
						<span class="text-sm text-muted-foreground">
							หน้า {currentPage} / {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onclick={() => gotoPage(currentPage + 1)}
							disabled={currentPage >= totalPages || loading}
						>
							ถัดไป
							<ChevronRight class="size-4" />
						</Button>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
