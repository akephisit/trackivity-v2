<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { IconShield, IconHome, IconArrowLeft } from '@tabler/icons-svelte/icons';
	import { goto } from '$app/navigation';

	function goBack() {
		history.back();
	}
</script>

<svelte:head>
    <title>ไม่มีสิทธิ์เข้าถึง - Trackivity</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900"
>
	<div class="w-full max-w-md">
		<Card class="text-center">
			<CardHeader class="pb-4">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
				>
					<IconShield class="h-8 w-8 text-red-600 dark:text-red-400" />
				</div>
				<CardTitle class="text-2xl font-bold text-gray-900 dark:text-white">
					ไม่มีสิทธิ์เข้าถึง
				</CardTitle>
				<CardDescription class="text-gray-600 dark:text-gray-400">
					คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากคุณคิดว่านี่เป็นข้อผิดพลาด
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div
					class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20"
				>
					<p class="text-sm text-yellow-800 dark:text-yellow-200">
						<strong>เหตุผลที่เป็นไปได้:</strong>
					</p>
					<ul
						class="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-700 dark:text-yellow-300"
					>
						<li>คุณไม่ได้เป็นผู้ดูแลระบบ</li>
						<li>บัญชีของคุณไม่มีสิทธิ์ที่จำเป็น</li>
						<li>Session ของคุณอาจหมดอายุแล้ว</li>
					</ul>
				</div>

				<div class="flex flex-col gap-3 sm:flex-row">
					<Button onclick={goBack} variant="outline" class="flex-1">
						<IconArrowLeft class="mr-2 h-4 w-4" />
						กลับไปหน้าก่อนหน้า
					</Button>
					<Button onclick={() => goto('/')} class="flex-1">
						<IconHome class="mr-2 h-4 w-4" />
						กลับสู่หน้าแรก
					</Button>
				</div>

				<div class="text-center">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						หากคุณต้องการความช่วยเหลือ กรุณาติดต่อผู้ดูแลระบบ
					</p>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

<style>
	:global(body) {
		background-color: rgb(249 250 251);
	}
	:global(.dark body) {
		background-color: rgb(17 24 39);
	}
</style>
