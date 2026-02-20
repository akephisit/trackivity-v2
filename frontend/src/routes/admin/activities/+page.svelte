<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { activities as activitiesApi, type Activity } from '$lib/api';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
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
		IconRefresh
	} from '@tabler/icons-svelte/icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';
	import { formatViewCount, formatParticipantCount } from '$lib/utils/activity-tracking';

	let allActivities = $state<Activity[]>([]);
	let loading = $state(true);
	let searchTerm = $state('');
	let selectedType = $state('all');
	let selectedStatus = $state('all');

	onMount(async () => {
		try {
			allActivities = await activitiesApi.list();
		} catch {
			toast.error('ไม่สามารถโหลดรายการกิจกรรมได้');
		} finally {
			loading = false;
		}

		const deleted = page.url.searchParams.get('deleted');
		if (deleted === '1') {
			toast.success('ลบกิจกรรมสำเร็จ');
			goto('/admin/activities', { replaceState: true, noScroll: true });
		}
	});

	let stats = $derived({
		total: allActivities.length,
		academic: allActivities.filter((a) => a.activity_type === 'academic').length,
		sports: allActivities.filter((a) => a.activity_type === 'sports').length,
		cultural: allActivities.filter((a) => a.activity_type === 'cultural').length,
		ongoing: allActivities.filter((a) => a.status === 'ongoing').length,
		totalParticipants: 0,
		totalViews: 0
	});

	let filteredActivities = $derived(
		allActivities.filter((activity) => {
			const matchesSearch =
				searchTerm === '' ||
				activity.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				activity.location?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesType = selectedType === 'all' || activity.activity_type === selectedType;
			const matchesStatus = selectedStatus === 'all' || activity.status === selectedStatus;
			return matchesSearch && matchesType && matchesStatus;
		})
	);

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			day: 'numeric', month: 'short', year: '2-digit'
		});
	}

	function getActivityStatus(activity: Activity): {
		label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline';
	} {
		switch (activity.status) {
			case 'draft': return { label: 'แบบร่าง', variant: 'outline' };
			case 'published': return { label: 'เผยแพร่แล้ว', variant: 'default' };
			case 'ongoing': return { label: 'กำลังดำเนินการ', variant: 'default' };
			case 'completed': return { label: 'เสร็จสิ้น', variant: 'secondary' };
			case 'cancelled': return { label: 'ยกเลิกแล้ว', variant: 'destructive' };
			default: return { label: 'ไม่ระบุ', variant: 'outline' };
		}
	}
</script>

<svelte:head><title>จัดการกิจกรรม - Trackivity</title></svelte:head>

<div class="space-y-4 lg:space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="admin-page-title flex items-center gap-2">
				<IconCalendarEvent class="size-6 text-primary" /> จัดการกิจกรรม
			</h1>
			<p class="text-sm text-muted-foreground">จัดการและติดตามกิจกรรมทั้งหมด</p>
		</div>
		<Button onclick={() => goto('/admin/activities/create')} class="flex w-full items-center gap-2 sm:w-auto">
			<IconPlus class="h-4 w-4" />สร้างกิจกรรมใหม่
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
		{#each [
			{ label: 'กิจกรรมทั้งหมด', value: stats.total, icon: IconCalendarEvent },
			{ label: 'วิชาการ', value: stats.academic, icon: IconUsers },
			{ label: 'กีฬา', value: stats.sports, icon: IconUsers },
			{ label: 'กำลังดำเนินการ', value: stats.ongoing, icon: IconRefresh }
		] as s}
			<Card>
				<CardContent class="p-4 lg:p-6">
					<div class="flex items-center justify-between">
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs text-muted-foreground lg:text-sm">{s.label}</p>
							<p class="text-lg font-bold lg:text-2xl">{s.value}</p>
						</div>
						<div class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 lg:h-10 lg:w-10">
							<s.icon class="h-4 w-4 text-primary lg:h-5 lg:w-5" />
						</div>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="p-4">
			<div class="space-y-4 sm:flex sm:flex-row sm:gap-4 sm:space-y-0">
				<div class="flex-1">
					<div class="relative">
						<IconSearch class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input bind:value={searchTerm} placeholder="ค้นหากิจกรรมหรือสถานที่..." class="pl-10" />
					</div>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger class="w-full sm:w-48">
							{selectedType === 'all' ? 'ทุกประเภท' : getActivityTypeDisplayName(selectedType)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกประเภท</Select.Item>
							<Select.Item value="academic">วิชาการ</Select.Item>
							<Select.Item value="sports">กีฬา</Select.Item>
							<Select.Item value="cultural">วัฒนธรรม</Select.Item>
							<Select.Item value="social">สังคม</Select.Item>
							<Select.Item value="other">อื่นๆ</Select.Item>
						</Select.Content>
					</Select.Root>
					<Select.Root type="single" bind:value={selectedStatus}>
						<Select.Trigger class="w-full sm:w-48">{selectedStatus === 'all' ? 'ทุกสถานะ' : selectedStatus}</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกสถานะ</Select.Item>
							<Select.Item value="draft">แบบร่าง</Select.Item>
							<Select.Item value="published">เผยแพร่แล้ว</Select.Item>
							<Select.Item value="ongoing">กำลังดำเนินการ</Select.Item>
							<Select.Item value="completed">เสร็จสิ้น</Select.Item>
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
			{#if loading}
				<div class="py-12 text-center">
					<div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
				</div>
			{:else if filteredActivities.length > 0}
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
										<div class="min-w-0 space-y-1">
											<p class="truncate font-medium">{activity.title || 'ไม่ระบุ'}</p>
											{#if activity.description}
												<p class="line-clamp-1 text-sm text-muted-foreground">{activity.description}</p>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant="secondary">{getActivityTypeDisplayName(activity.activity_type)}</Badge>
									</Table.Cell>
									<Table.Cell>
										<p class="text-sm font-medium">{formatDate(activity.start_date)}</p>
									</Table.Cell>
									<Table.Cell>
										{#if activity.location}
											<div class="flex items-center gap-1 text-sm">
												<IconMapPin class="h-3 w-3 text-muted-foreground" />
												<span class="truncate">{activity.location}</span>
											</div>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={status.variant}>{status.label}</Badge>
									</Table.Cell>
									<Table.Cell class="text-right">
										<div class="flex items-center justify-end gap-2">
											<Button variant="ghost" size="sm" onclick={() => goto(`/admin/activities/${activity.id}`)}>
												<IconEye class="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="sm" onclick={() => goto(`/admin/activities/${activity.id}/edit`)}>
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
						{searchTerm || selectedType !== 'all' || selectedStatus !== 'all' ? 'ไม่พบกิจกรรมที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีกิจกรรมในระบบ'}
					</p>
					{#if !searchTerm && selectedType === 'all' && selectedStatus === 'all'}
						<Button onclick={() => goto('/admin/activities/create')}>
							<IconPlus class="mr-2 h-4 w-4" />สร้างกิจกรรมแรก
						</Button>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
