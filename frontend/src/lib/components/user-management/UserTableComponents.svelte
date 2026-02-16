<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		IconUser,
		IconMail,
		IconPhone,
		IconCalendar,
		IconDots,
		IconEdit,
		IconTrash,
		IconUserCheck,
		IconUserX,
		IconUserPause,
		IconEye,
		IconCopy,
		IconDownload
	} from '@tabler/icons-svelte/icons';
	import type { User } from '$lib/types/admin';
	import { createEventDispatcher } from 'svelte';
	import { getRoleText, getRoleBadgeVariant } from '$lib/utils';

	const dispatch = createEventDispatcher<{
		viewUser: User;
		editUser: User;
		updateStatus: { user: User; status: 'active' | 'inactive' | 'suspended' };
		updateRole: { user: User; role: 'student' | 'faculty' | 'staff' | 'admin' };
		deleteUser: User;
		transferUser: User;
		viewActivity: User;
	}>();

	// Helper functions for display formatting
	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatRelativeTime(dateString: string | undefined): string {
		if (!dateString) return 'ไม่เคย';

		const date = new Date(dateString);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'เมื่อสักครู่';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
		if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;

		return formatDate(dateString);
	}

	function getStatusLabel(status: string): string {
		const statusLabels = {
			active: 'เปิดใช้งาน',
			inactive: 'ปิดใช้งาน',
			suspended: 'ถูกระงับ'
		};
		return statusLabels[status as keyof typeof statusLabels] || status;
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		const variants = {
			active: 'default' as const,
			inactive: 'secondary' as const,
			suspended: 'destructive' as const
		};
		return variants[status as keyof typeof variants] || 'outline';
	}

	// Component props will be passed via renderSnippet calls
	export let user: User | undefined = undefined;
	export let role: string | undefined = undefined;
	export let status: string | undefined = undefined;
	export let phone: string | undefined = undefined;
	export let lastLogin: string | undefined = undefined;
	export let created_at: string | undefined = undefined;
	export let emailVerifiedAt: string | undefined = undefined;
	export let checked: boolean | undefined = undefined;
	export let indeterminate: boolean | undefined = undefined;
	export let onCheckedChange: ((value: boolean) => void) | undefined = undefined;
</script>

<!-- Data Table Checkbox Component -->
{#if checked !== undefined}
	<div class="flex items-center">
		<Checkbox {checked} {indeterminate} {onCheckedChange} aria-label="เลือกรายการ" />
	</div>
{/if}

<!-- User Profile Cell Component -->
{#if user}
	<div class="flex min-w-0 items-center gap-3">
		<Avatar class="h-8 w-8 flex-shrink-0">
			{#if user.avatar}
				<AvatarImage src={user.avatar} alt="{user.first_name} {user.last_name}" />
			{/if}
			<AvatarFallback class="text-sm">
				{getInitials(user.first_name, user.last_name)}
			</AvatarFallback>
		</Avatar>
		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium">
				{user.first_name}
				{user.last_name}
			</div>
			<div class="truncate text-xs text-muted-foreground">
				{user.email}
			</div>
		</div>
	</div>
{/if}

<!-- Email Cell Component -->
{#if user}
	<div class="flex items-center gap-2">
		<IconMail class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
		<a href="mailto:{user.email}" class="truncate text-sm hover:underline" title={user.email}>
			{user.email}
		</a>
		{#if user.email_verified_at}
			<IconUserCheck class="h-3 w-3 flex-shrink-0 text-green-600" />
		{/if}
	</div>
{/if}

<!-- Identifier Cell Component (Student ID / Employee ID) -->
{#if user}
	<div class="font-mono text-sm">
		{user.student_id || user.employee_id || '-'}
	</div>
{/if}

<!-- Role Badge Component -->
{#if role}
	<Badge variant={getRoleBadgeVariant(role)} class="text-xs">
		{getRoleText(role)}
	</Badge>
{/if}

<!-- Status Badge Component -->
{#if status}
	<Badge variant={getStatusVariant(status)} class="text-xs">
		{getStatusLabel(status)}
	</Badge>
{/if}

<!-- Organization Cell Component -->
{#if user}
	<div class="truncate text-sm" title={(user as any).organization?.name || '-'}>
		{(user as any).organization?.name || '-'}
	</div>
{/if}

<!-- Department Cell Component -->
{#if user}
	<div class="truncate text-sm" title={user.department?.name || '-'}>
		{user.department?.name || '-'}
	</div>
{/if}

<!-- Phone Cell Component -->
{#if phone !== undefined}
	<div class="flex items-center gap-2">
		{#if phone}
			<IconPhone class="h-4 w-4 text-muted-foreground" />
			<a href="tel:{phone}" class="text-sm hover:underline">
				{phone}
			</a>
		{:else}
			<span class="text-sm text-muted-foreground">-</span>
		{/if}
	</div>
{/if}

<!-- Last Login Cell Component -->
{#if lastLogin !== undefined}
	<div class="text-sm" title={lastLogin ? formatDate(lastLogin) : ''}>
		{formatRelativeTime(lastLogin)}
	</div>
{/if}

<!-- Created At Cell Component -->
{#if created_at}
	<div class="flex items-center gap-2">
		<IconCalendar class="h-4 w-4 text-muted-foreground" />
		<span class="text-sm">{formatDate(created_at)}</span>
	</div>
{/if}

<!-- Email Verified Cell Component -->
{#if emailVerifiedAt !== undefined}
	<div class="flex items-center justify-center">
		{#if emailVerifiedAt}
			<IconUserCheck class="h-4 w-4 text-green-600" />
		{:else}
			<IconUserX class="h-4 w-4 text-orange-500" />
		{/if}
	</div>
{/if}

<!-- User Actions Menu Component -->
{#if user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<Button variant="ghost" size="icon" class="h-8 w-8">
				<IconDots class="h-4 w-4" />
				<span class="sr-only">เปิดเมนู</span>
			</Button>
		</DropdownMenu.Trigger>

		<DropdownMenu.Content align="end" class="w-56">
			<!-- View User Details -->
			<DropdownMenu.Item onclick={() => dispatch('viewUser', user)}>
				<IconEye class="mr-2 h-4 w-4" />
				ดูรายละเอียด
			</DropdownMenu.Item>

			<!-- Edit User -->
			<DropdownMenu.Item onclick={() => dispatch('editUser', user)}>
				<IconEdit class="mr-2 h-4 w-4" />
				แก้ไขข้อมูล
			</DropdownMenu.Item>

			<!-- Copy User ID -->
			<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(user.id)}>
				<IconCopy class="mr-2 h-4 w-4" />
				คัดลอก ID
			</DropdownMenu.Item>

			<DropdownMenu.Separator />

			<!-- Status Management -->
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<IconUserCheck class="mr-2 h-4 w-4" />
					เปลี่ยนสถานะ
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					{#if user.status !== 'active'}
						<DropdownMenu.Item onclick={() => dispatch('updateStatus', { user, status: 'active' })}>
							<IconUserCheck class="mr-2 h-4 w-4 text-green-600" />
							เปิดใช้งาน
						</DropdownMenu.Item>
					{/if}
					{#if user.status !== 'inactive'}
						<DropdownMenu.Item
							onclick={() => dispatch('updateStatus', { user, status: 'inactive' })}
						>
							<IconUserX class="mr-2 h-4 w-4 text-orange-500" />
							ปิดใช้งาน
						</DropdownMenu.Item>
					{/if}
					{#if user.status !== 'suspended'}
						<DropdownMenu.Item
							onclick={() => dispatch('updateStatus', { user, status: 'suspended' })}
						>
							<IconUserPause class="mr-2 h-4 w-4 text-red-600" />
							ระงับการใช้งาน
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>

			<!-- Role Management -->
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<IconUser class="mr-2 h-4 w-4" />
					เปลี่ยนบทบาท
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					{#if user.role !== 'student'}
						<DropdownMenu.Item onclick={() => dispatch('updateRole', { user, role: 'student' })}>
							นิสิต
						</DropdownMenu.Item>
					{/if}
					{#if user.role !== 'faculty'}
						<DropdownMenu.Item onclick={() => dispatch('updateRole', { user, role: 'faculty' })}>
							อาจารย์
						</DropdownMenu.Item>
					{/if}
					{#if user.role !== 'staff'}
						<DropdownMenu.Item onclick={() => dispatch('updateRole', { user, role: 'staff' })}>
							เจ้าหน้าที่
						</DropdownMenu.Item>
					{/if}
					{#if user.role !== 'admin'}
						<DropdownMenu.Item onclick={() => dispatch('updateRole', { user, role: 'admin' })}>
							ผู้ดูแลระบบ
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>

			<DropdownMenu.Separator />

			<!-- Additional Actions -->
			<DropdownMenu.Item onclick={() => dispatch('viewActivity', user)}>
				<IconCalendar class="mr-2 h-4 w-4" />
				ดูกิจกรรม
			</DropdownMenu.Item>

			<DropdownMenu.Item onclick={() => dispatch('transferUser', user)}>
				<IconDownload class="mr-2 h-4 w-4" />
				ย้ายหน่วยงาน/สาขา
			</DropdownMenu.Item>

			<DropdownMenu.Separator />

			<!-- Dangerous Actions -->
			<DropdownMenu.Item
				class="text-red-600 focus:bg-red-50 focus:text-red-600"
				onclick={() => dispatch('deleteUser', user)}
			>
				<IconTrash class="mr-2 h-4 w-4" />
				ลบผู้ใช้
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
