<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';

	let {
		ref = $bindable(null),
		class: className,
		value,
		...restProps
	}: WithoutChildrenOrChild<CalendarPrimitive.YearSelectProps> = $props();
</script>

<span
	class={cn(
		'relative flex rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
		className
	)}
>
	<CalendarPrimitive.YearSelect bind:ref class="absolute inset-0 opacity-0" {...restProps}>
		{#snippet child({ props, yearItems, selectedYearItem })}
			<select {...props} {value}>
				{#each yearItems as yearItem (yearItem.value)}
					<option
						value={yearItem.value}
						selected={value !== undefined
							? yearItem.value === value
							: yearItem.value === selectedYearItem.value}
					>
						{yearItem.label}
					</option>
				{/each}
			</select>
			<span
				class="flex h-8 w-fit items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap font-medium select-none [&>svg]:size-3.5 [&>svg]:text-muted-foreground"
				aria-hidden="true"
			>
				{yearItems.find((item) => item.value === value)?.label || selectedYearItem.label}
				<IconChevronDown class="size-4 opacity-50" />
			</span>
		{/snippet}
	</CalendarPrimitive.YearSelect>
</span>
