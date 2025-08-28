<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-svelte/icons';
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
				<IconSun class="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<IconMoon
					class="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
				/>
				<span class="sr-only">เปลี่ยนธีม</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={() => setMode('light')}>
			<IconSun class="mr-2 h-4 w-4" />
			โหมดสว่าง
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setMode('dark')}>
			<IconMoon class="mr-2 h-4 w-4" />
			โหมดมืด
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setMode('system')}>
			<IconDeviceDesktop class="mr-2 h-4 w-4" />
			ตามระบบ
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
