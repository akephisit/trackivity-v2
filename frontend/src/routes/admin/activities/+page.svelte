<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import {
		IconPlus,
		IconCalendarEvent,
		IconMapPin,
		IconUsers,
		IconEdit,
		IconEye,
		IconSearch,
		IconFilter,
		IconRefresh
	} from '@tabler/icons-svelte/icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { getActivityLevelDisplayName, getActivityTypeDisplayName } from '$lib/utils/activity';
	import { formatViewCount, formatParticipantCount } from '$lib/utils/activity-tracking';

	let { data } = $props();

	// Filter states
	let searchTerm = $state('');
	let selectedType = $state('all');
	let selectedStatus = $state('all');

	// Stats calculation
	let stats = $derived({
		total: data.activities.length,
		academic: data.activities.filter((a: any) => a.activity_type === 'Academic').length,
		sports: data.activities.filter((a: any) => a.activity_type === 'Sports').length,
		cultural: data.activities.filter((a: any) => a.activity_type === 'Cultural').length,
		ongoing: data.activities.filter((a: any) => getActivityStatus(a).label === 'กำลังดำเนินการ').length,
		totalParticipants: data.activities.reduce((sum: any, a: any) => sum + (a.participant_count || 0), 0),
		totalViews: data.activities.reduce((sum: any, a: any) => sum + (a.view_count || 0), 0)
	});

	// Filtered activities
	let filteredActivities = $derived(
		data.activities.filter((activity: any) => {
			const matchesSearch =
				searchTerm === '' ||
				activity.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				activity.location?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesType = selectedType === 'all' || activity.activity_type === selectedType;

			const matchesStatus =
				selectedStatus === 'all' || getActivityStatus(activity).label === selectedStatus;

			return matchesSearch && matchesType && matchesStatus;
		})
	);

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			day: 'numeric',
			month: 'short',
			year: '2-digit'
		});
	}

	function formatTime(timeString: string | undefined): string {
		if (!timeString) return '-';
		return timeString;
	}

	function getActivityTypeBadgeVariant(
		type: string | undefined
	): 'default' | 'secondary' | 'outline' {
		const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
			Academic: 'default',
			Sports: 'secondary',
			Cultural: 'outline',
			Social: 'default',
			Other: 'secondary'
		};
		return variants[type || ''] || 'outline';
	}

	function getActivityStatus(activity: any): {
		label: string;
		variant: 'default' | 'secondary' | 'destructive' | 'outline';
	} {
		const status = activity.status;

		switch (status) {
			case 'draft':
				return { label: 'แบบร่าง', variant: 'outline' };
			case 'published':
				return { label: 'เผยแพร่แล้ว', variant: 'default' };
			case 'ongoing':
				return { label: 'กำลังดำเนินการ', variant: 'default' };
			case 'completed':
				return { label: 'เสร็จสิ้น', variant: 'secondary' };
			case 'cancelled':
				return { label: 'ยกเลิกแล้ว', variant: 'destructive' };
			default:
				if (activity.start_date && activity.end_date) {
					const now = new Date();
					const startDate = new Date(activity.start_date);
					const endDate = new Date(activity.end_date);

					if (now < startDate) {
						return { label: 'รอดำเนินการ', variant: 'outline' };
					} else if (now >= startDate && now <= endDate) {
						return { label: 'กำลังดำเนินการ', variant: 'default' };
					} else {
						return { label: 'เสร็จสิ้น', variant: 'secondary' };
					}
				}
				return { label: 'ไม่ระบุ', variant: 'outline' };
		}
	}

	// Show toast when redirected after deletion
	$effect(() => {
		const deleted = page.url.searchParams.get('deleted');
		if (deleted === '1') {
			toast.success('ลบกิจกรรมสำเร็จ');
			goto('/admin/activities', { replaceState: true, noScroll: true });
		}
	});
</script>

<svelte:head>
	<title>จัดการกิจกรรม - Trackivity</title>
</svelte:head>

<div class="space-y-4 lg:space-y-6">
	<!-- Header Section -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="admin-page-title">
				<IconCalendarEvent class="size-6 text-primary" /> จัดการกิจกรรม
			</h1>
			<p class="text-sm text-muted-foreground">จัดการและติดตามกิจกรรมทั้งหมด</p>
		</div>
		<Button
			onclick={() => goto('/admin/activities/create')}
			class="flex w-full items-center gap-2 sm:w-auto"
		>
			<IconPlus class="h-4 w-4" />
			<span class="sm:inline">สร้างกิจกรรมใหม่</span>
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:gap-4">
		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">กิจกรรมทั้งหมด</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.total}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 lg:h-10 lg:w-10"
					>
						<IconCalendarEvent class="h-4 w-4 text-primary lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">กิจกรรมวิชาการ</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.academic}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 lg:h-10 lg:w-10"
					>
						<IconUsers class="h-4 w-4 text-blue-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">กิจกรรมกีฬา</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.sports}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-500/10 lg:h-10 lg:w-10"
					>
						<IconUsers class="h-4 w-4 text-green-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">กำลังดำเนินการ</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.ongoing}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10 lg:h-10 lg:w-10"
					>
						<IconRefresh class="h-4 w-4 text-orange-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">ผู้เข้าร่วมทั้งหมด</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.totalParticipants}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10 lg:h-10 lg:w-10"
					>
						<IconUsers class="h-4 w-4 text-purple-500 lg:h-5 lg:w-5" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-muted-foreground lg:text-sm">ยอดชมทั้งหมด</p>
						<p class="text-lg font-bold text-foreground lg:text-2xl">{stats.totalViews}</p>
					</div>
					<div
						class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10 lg:h-10 lg:w-10"
					>
						<IconEye class="h-4 w-4 text-orange-500 lg:h-5 lg:w-5" />
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
						<Input bind:value={searchTerm} placeholder="ค้นหากิจกรรมหรือสถานที่..." class="pl-10" />
					</div>
				</div>

				<!-- Filters -->
				<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
					<!-- Type Filter -->
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger class="w-full sm:w-48">
							{selectedType === 'all' ? 'ทุกประเภท' : getActivityTypeDisplayName(selectedType)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกประเภท</Select.Item>
							<Select.Item value="Academic">วิชาการ</Select.Item>
							<Select.Item value="Sports">กีฬา</Select.Item>
							<Select.Item value="Cultural">วัฒนธรรม</Select.Item>
							<Select.Item value="Social">สังคม</Select.Item>
							<Select.Item value="Other">อื่นๆ</Select.Item>
						</Select.Content>
					</Select.Root>

					<!-- Status Filter -->
					<Select.Root type="single" bind:value={selectedStatus}>
						<Select.Trigger class="w-full sm:w-48">
							{selectedStatus === 'all' ? 'ทุกสถานะ' : selectedStatus}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกสถานะ</Select.Item>
							<Select.Item value="แบบร่าง">แบบร่าง</Select.Item>
							<Select.Item value="เผยแพร่แล้ว">เผยแพร่แล้ว</Select.Item>
							<Select.Item value="กำลังดำเนินการ">กำลังดำเนินการ</Select.Item>
							<Select.Item value="เสร็จสิ้น">เสร็จสิ้น</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Activities Table -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<span>รายการกิจกรรม</span>
				<span class="text-sm font-normal text-muted-foreground">
					แสดง {filteredActivities.length} จาก {stats.total} กิจกรรม
				</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="p-0">
			{#if filteredActivities.length > 0}
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>กิจกรรม</Table.Head>
								<Table.Head>ประเภท</Table.Head>
								<Table.Head>วันที่</Table.Head>
								<Table.Head>สถานที่</Table.Head>
								<Table.Head>ผู้เข้าร่วม</Table.Head>
								<Table.Head>สถานะ</Table.Head>
								<Table.Head class="text-right">จัดการ</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each filteredActivities as activity}
								{@const status = getActivityStatus(activity)}
								<Table.Row class="hover:bg-muted/50">
									<Table.Cell>
										<div class="min-w-0 space-y-1">
											<p class="truncate font-medium text-foreground">
												{activity.title || 'ไม่ระบุ'}
											</p>
											{#if activity.description}
												<p class="line-clamp-2 text-sm text-muted-foreground">
													{activity.description}
												</p>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant={getActivityTypeBadgeVariant(activity.activity_type)}>
											{getActivityTypeDisplayName(activity.activity_type)}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<div class="space-y-1">
											<p class="text-sm font-medium">
												{formatDate(activity.start_date)}
											</p>
											{#if activity.start_time}
												<p class="text-xs text-muted-foreground">
													{formatTime(activity.start_time)}
												</p>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<div class="flex min-w-0 items-center gap-1 text-sm">
											{#if activity.location}
												<IconMapPin class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
												<span class="truncate">{activity.location}</span>
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<div class="flex min-w-0 items-center gap-2 text-sm">
											<div class="flex items-center gap-1">
												<IconUsers class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
												<span class="font-medium">{formatParticipantCount(activity.participant_count || 0, activity.max_participants)}</span>
											</div>
											{#if activity.view_count && activity.view_count > 0}
												<div class="flex items-center gap-1 text-xs text-muted-foreground">
													<IconEye class="h-3 w-3 flex-shrink-0" />
													<span>{formatViewCount(activity.view_count)}</span>
												</div>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant={status.variant}>
											{status.label}
										</Badge>
									</Table.Cell>
									<Table.Cell class="text-right">
										<div class="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="sm"
												onclick={() => goto(`/admin/activities/${activity.id}`)}
											>
												<IconEye class="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => goto(`/admin/activities/${activity.id}/edit`)}
											>
												<IconEdit class="h-4 w-4" />
											</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{:else}
				<div class="py-12 text-center">
					<IconCalendarEvent class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-medium">ไม่พบกิจกรรม</h3>
					<p class="mb-4 text-muted-foreground">
						{searchTerm || selectedType !== 'all' || selectedStatus !== 'all'
							? 'ไม่พบกิจกรรมที่ตรงกับเงื่อนไขการค้นหา'
							: 'ยังไม่มีกิจกรรมในระบบ'}
					</p>
					{#if !searchTerm && selectedType === 'all' && selectedStatus === 'all'}
						<Button onclick={() => goto('/admin/activities/create')}>
							<IconPlus class="mr-2 h-4 w-4" />
							สร้างกิจกรรมแรก
						</Button>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
