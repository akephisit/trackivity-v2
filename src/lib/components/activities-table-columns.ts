import type { ColumnDef } from '@tanstack/table-core';
import type { Activity } from '$lib/types/activity.js';
import { renderComponent, renderSnippet } from '$lib/components/ui/data-table/index.js';
import { Badge } from '$lib/components/ui/badge/index.js';
import { Button } from '$lib/components/ui/button/index.js';
import { createRawSnippet } from 'svelte';
import { getActivityLevelDisplayName, getActivityTypeDisplayName } from '$lib/utils/activity';

export const activityColumns: ColumnDef<Activity>[] = [
	{
		accessorKey: 'name',
		header: 'ชื่อกิจกรรม',
		cell: ({ row }) => {
			const activity = row.original;
			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="font-medium">
							${activity.name || activity.title || 'ไม่ระบุชื่อกิจกรรม'}
						</div>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'organizer',
		header: 'หน่วยงานที่จัด',
		cell: ({ row }) => {
			const activity = row.original;
			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="max-w-[200px]">
							<div class="font-medium text-sm">${activity.organizer || 'ไม่ระบุผู้จัด'}</div>
							<div class="text-xs text-muted-foreground">${activity.organizerType || ''}</div>
						</div>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'activity_type',
		header: 'ประเภทกิจกรรม',
		cell: ({ row }) => {
			const activity = row.original;
			const type = activity.activity_type;

			if (!type) {
				return renderSnippet(
					createRawSnippet(() => ({
						render: () => `
							<span class="text-muted-foreground text-sm">-</span>
						`
					}))
				);
			}

			const displayName = getActivityTypeDisplayName(type);
			const variantMap: Record<string, string> = {
				Academic: 'default',
				Sports: 'secondary',
				Cultural: 'outline',
				Social: 'default',
				Other: 'secondary'
			};
			const variant = variantMap[type] || 'outline';

			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
							variant === 'default'
								? 'bg-primary/10 text-primary'
								: variant === 'secondary'
									? 'bg-secondary text-secondary-foreground'
									: 'bg-muted text-muted-foreground border'
						}">
							${displayName}
						</span>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'activity_level',
		header: 'ระดับกิจกรรม',
		cell: ({ row }) => {
			const activity = row.original;
			const level = activity.activity_level || 'faculty';
			const displayName = getActivityLevelDisplayName(level);

			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="flex items-center gap-2">
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
								level === 'university'
									? 'bg-purple-100 text-purple-800'
									: 'bg-blue-100 text-blue-800'
							}">
								${displayName}
							</span>
						</div>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'participantCount',
		header: () =>
			renderSnippet(
				createRawSnippet(() => ({
					render: () => '<div class="text-center">จำนวนคน</div>'
				}))
			),
		cell: ({ row }) => {
			const count = row.getValue('participantCount') as number;
			const safeCount = count ?? 0;
			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="text-center font-medium">
							${safeCount.toLocaleString('th-TH')}
						</div>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'status',
		header: 'สถานะ',
		cell: ({ row }) => {
			const status = (row.getValue('status') as Activity['status']) || 'draft';
			const variant =
				status === 'completed' ? 'default' : status === 'ongoing' ? 'secondary' : 'outline';

			// Map status to Thai labels
			const statusLabels = {
				draft: 'ร่าง',
				published: 'เผยแพร่แล้ว',
				ongoing: 'กำลังดำเนินการ',
				completed: 'เสร็จสิ้น',
				cancelled: 'ยกเลิก'
			};

			const label = statusLabels[status] || status || 'ไม่ระบุสถานะ';

			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="flex items-center gap-2">
							<div class="w-2 h-2 rounded-full ${
								status === 'completed'
									? 'bg-green-500'
									: status === 'ongoing'
										? 'bg-yellow-500'
										: 'bg-gray-400'
							}"></div>
							<span class="text-sm font-medium">${label}</span>
						</div>
					`
				}))
			);
		}
	},
	{
		accessorKey: 'createdAt',
		header: 'วันที่สร้าง',
		cell: ({ row }) => {
			const dateValue = row.getValue('createdAt') as string;
			const activity = row.original;
			const safeDateValue = dateValue || activity.created_at || new Date().toISOString();
			const date = new Date(safeDateValue);
			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="text-sm text-muted-foreground">
							${
								isNaN(date.getTime())
									? 'ไม่ระบุวันที่'
									: date.toLocaleDateString('th-TH', {
											year: 'numeric',
											month: 'short',
											day: 'numeric'
										})
							}
						</div>
					`
				}))
			);
		}
	},
	{
		id: 'actions',
		header: '',
		cell: ({ row }) => {
			return renderSnippet(
				createRawSnippet(() => ({
					render: () => `
						<div class="flex items-center gap-2">
							<button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors">
								ดูรายละเอียด
							</button>
							<button class="px-3 py-1 text-xs border border-border rounded-md hover:bg-accent transition-colors">
								แก้ไข
							</button>
						</div>
					`
				}))
			);
		}
	}
];
