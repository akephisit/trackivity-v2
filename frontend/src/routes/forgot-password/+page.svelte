<script lang="ts">
	import { auth, ApiError } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { IconLoader, IconMail, IconArrowLeft } from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';

	let email = $state('');
	let submitting = $state(false);
	let success = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;

		try {
			const result = await auth.forgotPassword(email);
			toast.success(result.message);
			success = true;
		} catch (err) {
			if (err instanceof ApiError) {
				toast.error(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
			} else {
				toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<MetaTags title="ลืมรหัสผ่าน" description="ขอรีเซ็ตรหัสผ่านสำหรับ Trackivity" />

<div
	class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600"
			>
				<IconMail class="h-8 w-8 text-white" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Trackivity</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">ลืมรหัสผ่าน</p>
		</div>

		<Card class="w-full">
			<CardHeader class="space-y-1">
				<CardTitle class="flex items-center justify-center gap-2 text-center text-2xl">
					รีเซ็ตรหัสผ่าน
				</CardTitle>
				<CardDescription class="text-center">
					กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				{#if success}
					<div class="rounded-md bg-green-50 p-4 dark:bg-green-900/30">
						<div class="flex">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm font-medium text-green-800 dark:text-green-200">
									หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับเปลี่ยนรหัสผ่านไปเรียบร้อยแล้ว
									กรุณาตรวจสอบกล่องจดหมายของคุณ (หรือโฟลเดอร์สแปม)
								</p>
							</div>
						</div>
					</div>
					<div class="mt-4 text-center">
						<Button variant="outline" class="w-full" href="/login">กลับไปหน้าเข้าสู่ระบบ</Button>
					</div>
				{:else}
					<form onsubmit={handleSubmit} class="space-y-4">
						<div class="space-y-2">
							<Label for="email">อีเมล</Label>
							<Input
								id="email"
								type="email"
								bind:value={email}
								placeholder="example@email.com"
								disabled={submitting}
								class="w-full"
								required
							/>
						</div>

						<Button
							type="submit"
							class="w-full bg-green-600 text-white hover:bg-green-700"
							disabled={submitting}
						>
							{#if submitting}
								<IconLoader class="mr-2 h-4 w-4 animate-spin" />
								กำลังส่ง...
							{:else}
								ส่งลิงก์รีเซ็ตรหัสผ่าน
							{/if}
						</Button>
					</form>
				{/if}

				<div class="mt-4 flex justify-center">
					<a
						href="/login"
						class="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
					>
						<IconArrowLeft class="mr-1 h-4 w-4" />
						กลับไปหน้าเข้าสู่ระบบ
					</a>
				</div>
			</CardContent>
		</Card>

		<div class="text-center text-xs text-gray-500 dark:text-gray-400">
			<p>© 2025 Trackivity System. All rights reserved.</p>
		</div>
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
