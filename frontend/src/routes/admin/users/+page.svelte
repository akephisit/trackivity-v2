<script lang="ts">
	import { usersApi, organizationsApi, ApiError } from '$lib/api';
	import type { UserListItem, Organization } from '$lib/api';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		IconUsers,
		IconUserCheck,
		IconUserX,
		IconSearch,
		IconRefresh,
	} from '@tabler/icons-svelte/icons';
	import { goto } from '$app/navigation';

	// ─── State ──────────────────────────────────────────────────────────────
	let users = $state<UserListItem[]>([]);
	let organizations = $state<Organization[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let searchTerm = $state('');
	let selectedRole = $state('all');
	let selectedStatus = $state('all');
	let selectedOrg = $state('all');

	// ─── Derived ────────────────────────────────────────────────────────────
	let filteredUsers = $derived(
		users.filter((user) => {
			const matchesSearch =
				searchTerm === '' ||
				user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.student_id?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
			const matchesOrg = selectedOrg === 'all' || user.organization_name === selectedOrg;

			return matchesSearch && matchesStatus && matchesOrg;
		})
	);

	let stats = $derived({
		total: users.length,
		active: users.filter((u) => u.status === 'active').length,
		inactive: users.filter((u) => u.status !== 'active').length,
	});

	// ─── Data Fetching ──────────────────────────────────────────────────────
	async function fetchData() {
		loading = true;
		error = null;
		try {
			const [userResult, orgData] = await Promise.all([
				usersApi.list(),
				organizationsApi.listAdmin().catch(() => [] as Organization[]),
			]);
			users = userResult.users;
			organizations = orgData;
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
			<IconRefresh class="mr-2 size-4 {loading ? 'animate-spin' : ''}" />
			รีเฟรช
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<IconUsers class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">{stats.total}</p>
					<p class="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<IconUserCheck class="size-8 text-green-600" />
				<div>
					<p class="text-2xl font-bold">{stats.active}</p>
					<p class="text-sm text-muted-foreground">เปิดใช้งาน</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<IconUserX class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">{stats.inactive}</p>
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
					<IconSearch class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input bind:value={searchTerm} placeholder="ค้นหาผู้ใช้..." class="pl-9" />
				</div>
				<select
					bind:value={selectedStatus}
					class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm sm:w-40"
				>
					<option value="all">สถานะทั้งหมด</option>
					<option value="active">เปิดใช้งาน</option>
					<option value="inactive">ปิดใช้งาน</option>
					<option value="suspended">ระงับ</option>
				</select>
				<select
					bind:value={selectedOrg}
					class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm sm:w-48"
				>
					<option value="all">หน่วยงานทั้งหมด</option>
					{#each organizations as org}
						<option value={org.name}>{org.name}</option>
					{/each}
				</select>
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="space-y-3">
					{#each Array(6) as _}
						<Skeleton class="h-10 w-full" />
					{/each}
				</div>
			{:else if error}
				<div class="py-8 text-center text-destructive">{error}</div>
			{:else if filteredUsers.length === 0}
				<div class="py-12 text-center">
					<IconUsers class="mx-auto mb-4 size-12 text-muted-foreground/50" />
					<p class="text-muted-foreground">ไม่พบผู้ใช้</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>ผู้ใช้</Table.Head>
							<Table.Head>รหัสนักศึกษา</Table.Head>
							<Table.Head>หน่วยงาน</Table.Head>
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
								<Table.Cell>
									<span class="text-sm">{user.organization_name ?? '-'}</span>
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
									<span class="text-sm text-muted-foreground">{formatDate(user.last_login_at)}</span>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				<p class="mt-4 text-center text-sm text-muted-foreground">
					แสดง {filteredUsers.length} จากทั้งหมด {users.length} คน
				</p>
			{/if}
		</CardContent>
	</Card>
</div>
