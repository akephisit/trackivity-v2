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
	import * as Table from '$lib/components/ui/table';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		type ColumnFiltersState,
		type SortingState,
		type VisibilityState,
		type RowSelectionState
	} from '@tanstack/table-core';
	import { createSvelteTable } from '$lib/components/ui/data-table/data-table.svelte.js';
	import { FlexRender } from '$lib/components/ui/data-table';
	import {
		IconUsers,
		IconUserCheck,
		IconUserX,
		IconRefresh,
		IconTrash
	} from '@tabler/icons-svelte/icons';
	import { usersApi } from '$lib/api';
	import type { UserListItem } from '$lib/api';
	import { onMount } from 'svelte';
	import { getUserTableColumns, columnVisibilityPresets } from '$lib/components/user-table-columns';

	// ─── CSR State ────────────────────────────────────────────────────────────
	let usersList = $state<UserListItem[]>([]);
	let loading = $state(true);

	// Table state
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>(columnVisibilityPresets.detailed);
	let rowSelection = $state<RowSelectionState>({});

	const columns = $derived(getUserTableColumns('regular_admin', false) as any[]);

	const table = $derived(
		createSvelteTable({
			get data() { return usersList; },
			columns,
			state: {
				get sorting() { return sorting; },
				get columnFilters() { return columnFilters; },
				get columnVisibility() { return columnVisibility; },
				get rowSelection() { return rowSelection; },
			},
			enableRowSelection: true,
			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			onSortingChange: (u) => { sorting = typeof u === 'function' ? u(sorting) : u; },
			onColumnFiltersChange: (u) => { columnFilters = typeof u === 'function' ? u(columnFilters) : u; },
			onColumnVisibilityChange: (u) => { columnVisibility = typeof u === 'function' ? u(columnVisibility) : u; },
			onRowSelectionChange: (u) => { rowSelection = typeof u === 'function' ? u(rowSelection) : u; },
		})
	);

	const selectedUsers = $derived(Object.keys(rowSelection).filter((k) => rowSelection[k]));

	const stats = $derived({
		total: usersList.length,
		active: usersList.filter((u: UserListItem) => u.status === 'active').length,
	});

	onMount(async () => {
		try {
			const result = await usersApi.list();
			usersList = result.users ?? [];
		} catch {
			// silently handle
		} finally {
			loading = false;
		}
	});
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
				<IconUsers class="size-6 text-primary" />
				จัดการผู้ใช้หน่วยงาน
			</h1>
			<p class="text-muted-foreground">จัดการข้อมูลผู้ใช้ในระบบ</p>
		</div>
		<Button variant="outline" onclick={() => location.reload()} disabled={loading}>
			<IconRefresh class="mr-2 h-4 w-4 {loading ? 'animate-spin' : ''}" />
			รีเฟรช
		</Button>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-2 gap-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle>
				<IconUsers class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.total.toLocaleString()}</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">ผู้ใช้ที่เปิดใช้งาน</CardTitle>
				<IconUserCheck class="h-4 w-4 text-green-600" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.active.toLocaleString()}</div>
				<p class="text-xs text-muted-foreground">
					{stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}% ของผู้ใช้ทั้งหมด
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Bulk Actions Bar -->
	{#if selectedUsers.length > 0}
		<Card class="border-primary/20 bg-primary/5">
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Badge variant="secondary">{selectedUsers.length} รายการที่เลือก</Badge>
						<span class="text-sm text-muted-foreground">จาก {usersList.length} รายการ</span>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm"><IconUserCheck class="mr-2 h-4 w-4" />เปิดใช้งาน</Button>
						<Button variant="outline" size="sm"><IconUserX class="mr-2 h-4 w-4" />ปิดใช้งาน</Button>
						<Button variant="destructive" size="sm"><IconTrash class="mr-2 h-4 w-4" />ลบ</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Users Table -->
	<Card>
		<CardHeader>
			<CardTitle>รายการผู้ใช้</CardTitle>
			<CardDescription>แสดงผลจำนวน {usersList.length} รายการ</CardDescription>
		</CardHeader>
		<CardContent class="p-0">
			<div class="overflow-hidden">
				<Table.Root>
					<Table.Header>
						{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
							<Table.Row>
								{#each headerGroup.headers as header (header.id)}
									<Table.Head
										colspan={header.colSpan}
										class={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
										onclick={header.column.getToggleSortingHandler()}
									>
										{#if !header.isPlaceholder}
											<FlexRender
												content={header.column.columnDef.header}
												context={header.getContext()}
											/>
										{/if}
									</Table.Head>
								{/each}
							</Table.Row>
						{/each}
					</Table.Header>
					<Table.Body>
						{#if loading}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
									กำลังโหลด...
								</Table.Cell>
							</Table.Row>
						{:else if table.getRowModel().rows?.length}
							{#each table.getRowModel().rows as row (row.id)}
								<Table.Row data-state={row.getIsSelected() && 'selected'}>
									{#each row.getVisibleCells() as cell (cell.id)}
										<Table.Cell>
											<FlexRender
												content={cell.column.columnDef.cell}
												context={cell.getContext()}
											/>
										</Table.Cell>
									{/each}
								</Table.Row>
							{/each}
						{:else}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="h-24 text-center">
									<div class="flex flex-col items-center gap-2">
										<IconUsers class="h-8 w-8 text-muted-foreground" />
										<span class="text-muted-foreground">ไม่พบผู้ใช้</span>
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</CardContent>
	</Card>
</div>
