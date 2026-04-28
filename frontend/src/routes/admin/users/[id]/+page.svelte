<script lang="ts">
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import {
		ArrowLeft,
		Building as BuildingIcon,
		Calendar as CalendarIcon,
		CircleAlert,
		Clock,
		IdCard,
		Mail,
		RefreshCw,
		School,
		User as UserIcon
	} from '@lucide/svelte';
	import { usersApi, ApiError, type UserListItem } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let user = $state<UserListItem | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let loadError = $state<string | null>(null);

	async function loadUser() {
		const id = page.params.id!;
		loading = true;
		loadError = null;
		notFound = false;
		try {
			user = await usersApi.get(id);
		} catch (e) {
			if (e instanceof ApiError && e.status === 404) notFound = true;
			else loadError = e instanceof ApiError ? e.message : 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้';
		} finally {
			loading = false;
		}
	}

	onMount(loadUser);

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

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

	const fullName = $derived(
		user ? `${user.prefix} ${user.first_name} ${user.last_name}`.trim() : ''
	);
	const initials = $derived(
		user ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase() : ''
	);
</script>

<MetaTags
	title={user ? fullName : 'รายละเอียดผู้ใช้'}
	description="ดูรายละเอียดบัญชีผู้ใช้"
/>

<div class="space-y-6">
	<!-- Back -->
	<Button variant="ghost" size="sm" onclick={() => goto('/admin/users')} class="gap-1.5">
		<ArrowLeft class="size-4" />
		กลับไปรายชื่อผู้ใช้
	</Button>

	{#if loading}
		<Card>
			<CardHeader class="flex flex-row items-center gap-4">
				<Skeleton class="size-16 rounded-full" />
				<div class="flex-1 space-y-2">
					<Skeleton class="h-6 w-48" />
					<Skeleton class="h-4 w-64" />
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				{#each Array(6) as _}
					<Skeleton class="h-5 w-full" />
				{/each}
			</CardContent>
		</Card>
	{:else if notFound}
		<Card>
			<CardContent class="flex flex-col items-center gap-3 py-16 text-center">
				<UserIcon class="size-12 text-muted-foreground/50" />
				<div>
					<p class="text-lg font-medium">ไม่พบผู้ใช้</p>
					<p class="text-sm text-muted-foreground">ผู้ใช้คนนี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์ดู</p>
				</div>
				<Button variant="outline" onclick={() => goto('/admin/users')}>
					<ArrowLeft class="mr-2 size-4" />
					กลับไปรายชื่อผู้ใช้
				</Button>
			</CardContent>
		</Card>
	{:else if loadError}
		<Alert variant="destructive">
			<CircleAlert class="size-4" />
			<AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<span>{loadError}</span>
				<Button size="sm" variant="outline" onclick={loadUser}>
					<RefreshCw class="mr-2 size-4" />
					ลองใหม่
				</Button>
			</AlertDescription>
		</Alert>
	{:else if user}
		<!-- Identity card -->
		<Card>
			<CardHeader class="flex flex-row items-center gap-4 space-y-0">
				<div
					class="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
				>
					{initials}
				</div>
				<div class="min-w-0 flex-1 space-y-1">
					<CardTitle class="text-xl">{fullName}</CardTitle>
					<p class="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Mail class="size-3.5" />
						<span class="truncate">{user.email}</span>
					</p>
				</div>
				<Badge variant={getStatusBadgeVariant(user.status)} class="shrink-0">
					{getStatusText(user.status)}
				</Badge>
			</CardHeader>
			<Separator />
			<CardContent class="grid gap-4 pt-6 sm:grid-cols-2">
				<div class="flex items-start gap-3">
					<IdCard class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">รหัสนักศึกษา</p>
						<code class="text-sm font-medium">{user.student_id}</code>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<BuildingIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">หน่วยงาน</p>
						<p class="text-sm font-medium">{user.organization_name ?? '-'}</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<School class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">ภาควิชา</p>
						<p class="text-sm font-medium">{user.department_name ?? '-'}</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<CalendarIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">สมัครสมาชิกเมื่อ</p>
						<p class="text-sm font-medium">{formatDate(user.created_at)}</p>
					</div>
				</div>

				<div class="flex items-start gap-3 sm:col-span-2">
					<Clock class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด</p>
						<p class="text-sm font-medium">{formatDate(user.last_login_at)}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
