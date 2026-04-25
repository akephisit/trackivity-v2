<script lang="ts">
	import { CalendarDays, Pencil, Eye, MapPin, Plus, RefreshCw, Search, FileText, CircleAlert } from '@lucide/svelte';
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
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { getActivityTypeDisplayName } from '$lib/utils/activity';

	type ActivityStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';

	const STATUS_LABEL: Record<ActivityStatus, string> = {
		draft: 'แบบร่าง',
		published: 'เผยแพร่แล้ว',
		ongoing: 'กำลังดำเนินการ',
		completed: 'เสร็จสิ้น',
		cancelled: 'ยกเลิกแล้ว'
	};
	const STATUS_VARIANT: Record<ActivityStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		draft: 'outline',
		published: 'default',
		ongoing: 'default',
		completed: 'secondary',
		cancelled: 'destructive'
	};

	let allActivities = $state<Activity[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchTerm = $state('');
	let selectedType = $state('all');
	let selectedStatus = $state('all');

	async function loadActivities() {
		loading = true;
		error = null;
		try {
			allActivities = await activitiesApi.list();
		} catch (e: any) {
			error = e?.message ?? 'ไม่สามารถโหลดรายการกิจกรรมได้';
			toast.error('ไม่สามารถโหลดรายการกิจกรรมได้');
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		await loadActivities();

		const deleted = page.url.searchParams.get('deleted');
		if (deleted === '1') {
			toast.success('ลบกิจกรรมสำเร็จ');
			goto('/admin/activities', { replaceState: true, noScroll: true });
		}
	});

	// Single-pass reduce instead of four .filter().length calls over the same array.
	let stats = $derived.by(() => {
		const acc = { total: 0, ongoing: 0, published: 0, draft: 0 };
		for (const a of allActivities) {
			acc.total++;
			if (a.status === 'ongoing') acc.ongoing++;
			else if (a.status === 'published') acc.published++;
			else if (a.status === 'draft') acc.draft++;
		}
		return acc;
	});

	let filteredActivities = $derived(
		allActivities.filter((activity) => {
			const search = searchTerm.toLowerCase();
			const matchesSearch =
				search === '' ||
				activity.title?.toLowerCase().includes(search) ||
				activity.location?.toLowerCase().includes(search);
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
		const s = activity.status as ActivityStatus;
		return {
			label: STATUS_LABEL[s] ?? 'ไม่ระบุ',
			variant: STATUS_VARIANT[s] ?? 'outline'
		};
	}
</script>

<svelte:head><title>จัดการกิจกรรม - Trackivity</title></svelte:head>

<div class="space-y-4 lg:space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="admin-page-title flex items-center gap-2">
				<CalendarDays class="size-6 text-primary" /> จัดการกิจกรรม
			</h1>
			<p class="text-sm text-muted-foreground">จัดการและติดตามกิจกรรมทั้งหมด</p>
		</div>
		<Button onclick={() => goto('/admin/activities/create')} class="flex w-full items-center gap-2 sm:w-auto">
			<Plus class="h-4 w-4" />สร้างกิจกรรมใหม่
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
		{#each [
			{ label: 'กิจกรรมทั้งหมด', value: stats.total, icon: CalendarDays },
			{ label: 'กำลังดำเนินการ', value: stats.ongoing, icon: RefreshCw },
			{ label: 'เผยแพร่แล้ว', value: stats.published, icon: Eye },
			{ label: 'แบบร่าง', value: stats.draft, icon: FileText }
		] as s}
			<Card>
				<CardContent class="p-4 lg:p-6">
					<div class="flex items-center justify-between">
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs text-muted-foreground lg:text-sm">{s.label}</p>
							{#if loading}
								<Skeleton class="mt-1 h-7 w-12" />
							{:else}
								<p class="text-lg font-bold lg:text-2xl">{s.value}</p>
							{/if}
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
						<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
						<Select.Trigger class="w-full sm:w-48">
							{selectedStatus === 'all' ? 'ทุกสถานะ' : (STATUS_LABEL[selectedStatus as ActivityStatus] ?? selectedStatus)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">ทุกสถานะ</Select.Item>
							<Select.Item value="draft">แบบร่าง</Select.Item>
							<Select.Item value="published">เผยแพร่แล้ว</Select.Item>
							<Select.Item value="ongoing">กำลังดำเนินการ</Select.Item>
							<Select.Item value="completed">เสร็จสิ้น</Select.Item>
							<Select.Item value="cancelled">ยกเลิกแล้ว</Select.Item>
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
							{#each Array(5) as _}
								<Table.Row>
									{#each Array(6) as _}
										<Table.Cell><Skeleton class="h-4 w-full" /></Table.Cell>
									{/each}
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{:else if error}
				<div class="p-4">
					<Alert variant="destructive">
						<CircleAlert class="size-4" />
						<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<span>{error}</span>
							<Button size="sm" variant="outline" onclick={loadActivities}>
								<RefreshCw class="mr-2 size-4" />ลองใหม่
							</Button>
						</AlertDescription>
					</Alert>
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
											<div class="flex items-center gap-1 text-sm" title={activity.location}>
												<MapPin class="h-3 w-3 text-muted-foreground" />
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
												<Eye class="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="sm" onclick={() => goto(`/admin/activities/${activity.id}/edit`)}>
												<Pencil class="h-4 w-4" />
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
					<CalendarDays class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-medium">ไม่พบกิจกรรม</h3>
					<p class="mb-4 text-muted-foreground">
						{searchTerm || selectedType !== 'all' || selectedStatus !== 'all' ? 'ไม่พบกิจกรรมที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีกิจกรรมในระบบ'}
					</p>
					{#if !searchTerm && selectedType === 'all' && selectedStatus === 'all'}
						<Button onclick={() => goto('/admin/activities/create')}>
							<Plus class="mr-2 h-4 w-4" />สร้างกิจกรรมแรก
						</Button>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
