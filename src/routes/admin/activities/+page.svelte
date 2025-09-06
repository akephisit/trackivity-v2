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

	let { data } = $props();

	// Filter states
	let searchTerm = $state('');
	let selectedType = $state('all');
	let selectedStatus = $state('all');

	// Stats calculation
	let stats = $derived({
		total: data.activities.length,
		academic: data.activities.filter((a) => a.activity_type === 'Academic').length,
		sports: data.activities.filter((a) => a.activity_type === 'Sports').length,
		cultural: data.activities.filter((a) => a.activity_type === 'Cultural').length,
		ongoing: data.activities.filter((a) => getActivityStatus(a).label === 'กำลังดำเนินการ').length
	});

	// Filtered activities
	let filteredActivities = $derived(
		data.activities.filter((activity) => {
			const matchesSearch = searchTerm === '' || 
				activity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				activity.location?.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesType = selectedType === 'all' || activity.activity_type === selectedType;
			
			const matchesStatus = selectedStatus === 'all' || 
				getActivityStatus(activity).label === selectedStatus;

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

	function getActivityTypeBadgeVariant(type: string | undefined): 'default' | 'secondary' | 'outline' {
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
			<h1 class="admin-page-title"><IconCalendarEvent class="size-6 text-primary" /> จัดการกิจกรรม</h1>
			<p class="text-sm text-muted-foreground">จัดการและติดตามกิจกรรมทั้งหมด</p>
		</div>
		<Button onclick={() => goto('/admin/activities/create')} class="flex items-center gap-2 w-full sm:w-auto">
			<IconPlus class="w-4 h-4" />
			<span class="sm:inline">สร้างกิจกรรมใหม่</span>
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">กิจกรรมทั้งหมด</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.total}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconCalendarEvent class="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">กิจกรรมวิชาการ</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.academic}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUsers class="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">กิจกรรมกีฬา</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.sports}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconUsers class="w-4 h-4 lg:w-5 lg:h-5 text-green-500" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4 lg:p-6">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<p class="text-xs lg:text-sm text-muted-foreground truncate">กำลังดำเนินการ</p>
						<p class="text-lg lg:text-2xl font-bold text-foreground">{stats.ongoing}</p>
					</div>
					<div class="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
						<IconRefresh class="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
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
							placeholder="ค้นหากิจกรรมหรือสถานที่..."
							class="pl-10"
						/>
					</div>
				</div>

				<!-- Filters -->
				<div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
					<!-- Type Filter -->
					<Select.Root bind:selected={selectedType}>
						<Select.Trigger class="w-full sm:w-48">
							<Select.Value placeholder="ประเภทกิจกรรม" />
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
					<Select.Root bind:selected={selectedStatus}>
						<Select.Trigger class="w-full sm:w-48">
							<Select.Value placeholder="สถานะ" />
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
							<Table.Head>สถานะ</Table.Head>
							<Table.Head class="text-right">จัดการ</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredActivities as activity}
							{@const status = getActivityStatus(activity)}
							<Table.Row class="hover:bg-muted/50">
								<Table.Cell>
									<div class="space-y-1 min-w-0">
										<p class="font-medium text-foreground truncate">{activity.name || 'ไม่ระบุ'}</p>
										{#if activity.description}
											<p class="text-sm text-muted-foreground line-clamp-2">
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
									<div class="flex items-center gap-1 text-sm min-w-0">
										{#if activity.location}
											<IconMapPin class="w-3 h-3 text-muted-foreground flex-shrink-0" />
											<span class="truncate">{activity.location}</span>
										{:else}
											<span class="text-muted-foreground">-</span>
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
											<IconEye class="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => goto(`/admin/activities/${activity.id}/edit`)}
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
					<IconCalendarEvent class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
					<h3 class="text-lg font-medium mb-2">ไม่พบกิจกรรม</h3>
					<p class="text-muted-foreground mb-4">
						{searchTerm || selectedType !== 'all' || selectedStatus !== 'all' 
							? 'ไม่พบกิจกรรมที่ตรงกับเงื่อนไขการค้นหา' 
							: 'ยังไม่มีกิจกรรมในระบบ'}
					</p>
					{#if !searchTerm && selectedType === 'all' && selectedStatus === 'all'}
						<Button onclick={() => goto('/admin/activities/create')}>
							<IconPlus class="w-4 h-4 mr-2" />
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
