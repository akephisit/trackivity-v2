<script lang="ts">
	import { Monitor, Moon, Sun } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { mode, setMode } from 'mode-watcher';
	import type { ComponentProps } from 'svelte';

	type ButtonProps = ComponentProps<typeof Button>;

	let { variant = 'outline' as ButtonProps['variant'], size = 'default' as ButtonProps['size'] } =
		$props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} {variant} {size}>
				<Sun class="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<Moon
					class="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
				/>
				<span class="sr-only">เปลี่ยนธีม</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={() => setMode('light')}>
			<Sun class="mr-2 h-4 w-4" />
			โหมดสว่าง
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setMode('dark')}>
			<Moon class="mr-2 h-4 w-4" />
			โหมดมืด
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setMode('system')}>
			<Monitor class="mr-2 h-4 w-4" />
			ตามระบบ
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
