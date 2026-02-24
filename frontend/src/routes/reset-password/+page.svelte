<script lang="ts">
	import { auth, ApiError } from '$lib/api';
	import { page } from '$app/stores';
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
	import {
		IconLoader,
		IconCheck,
		IconEyeOff,
		IconEye,
		IconLock,
		IconArrowLeft
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let submitting = $state(false);
	let success = $state(false);

	let token = $derived($page.url.searchParams.get('token') || '');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;

		if (!token) {
			toast.error('ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน ลิงก์อาจไม่ถูกต้อง');
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error('รหัสผ่านไม่ตรงกัน');
			return;
		}

		if (newPassword.length < 6) {
			toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
			return;
		}

		submitting = true;

		try {
			await auth.resetPassword(token, newPassword);
			toast.success('ตั้งรหัสผ่านใหม่สำเร็จ');
			success = true;
		} catch (err) {
			if (err instanceof ApiError) {
				toast.error(err.message || 'เกิดข้อผิดพลาด หรือลิงก์อาจหมดอายุ');
			} else {
				toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<MetaTags title="ตั้งรหัสผ่านใหม่" description="ตั้งรหัสผ่านใหม่สำหรับ Trackivity" />

<div
	class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
				<IconLock class="h-8 w-8 text-white" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Trackivity</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">ตั้งรหัสผ่านใหม่</p>
		</div>

		<Card class="w-full">
			<CardHeader class="space-y-1">
				<CardTitle class="flex items-center justify-center gap-2 text-center text-2xl">
					กรอกรหัสผ่านใหม่
				</CardTitle>
				<CardDescription class="text-center">ตั้งรหัสผ่านที่รัดกุมและจำง่าย</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				{#if success}
					<div class="rounded-md bg-green-50 p-4 dark:bg-green-900/30">
						<div class="flex">
							<div class="flex-shrink-0">
								<IconCheck class="h-5 w-5 text-green-400" />
							</div>
							<div class="ml-3 text-center">
								<p class="text-sm font-medium text-green-800 dark:text-green-200">
									ตั้งค่ารหัสผ่านใหม่สำเร็จแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
								</p>
							</div>
						</div>
					</div>
					<div class="mt-4 text-center">
						<Button class="w-full bg-blue-600 hover:bg-blue-700" href="/login">
							ไปที่หน้าเข้าสู่ระบบ
						</Button>
					</div>
				{:else if !token}
					<div class="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
						<div class="flex">
							<div class="ml-3 text-center">
								<p class="text-sm font-medium text-red-800 dark:text-red-200">
									ลิงก์นี้ไม่ถูกต้องหรืออาจหมดอายุ กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่
								</p>
							</div>
						</div>
					</div>
					<div class="mt-4 text-center">
						<Button variant="outline" class="w-full" href="/forgot-password">
							ขอลิงก์รีเซ็ตรหัสผ่าน
						</Button>
					</div>
				{:else}
					<form onsubmit={handleSubmit} class="space-y-4">
						<div class="space-y-2">
							<Label for="password">รหัสผ่านใหม่</Label>
							<div class="relative">
								<Input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={newPassword}
									placeholder="••••••••"
									disabled={submitting}
									class="w-full pr-10"
									required
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3"
									tabindex="-1"
								>
									{#if showPassword}
										<IconEyeOff class="h-4 w-4 text-gray-400" />
									{:else}
										<IconEye class="h-4 w-4 text-gray-400" />
									{/if}
								</button>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
							<div class="relative">
								<Input
									id="confirm-password"
									type={showConfirmPassword ? 'text' : 'password'}
									bind:value={confirmPassword}
									placeholder="••••••••"
									disabled={submitting}
									class="w-full pr-10"
									required
								/>
								<button
									type="button"
									onclick={() => (showConfirmPassword = !showConfirmPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3"
									tabindex="-1"
								>
									{#if showConfirmPassword}
										<IconEyeOff class="h-4 w-4 text-gray-400" />
									{:else}
										<IconEye class="h-4 w-4 text-gray-400" />
									{/if}
								</button>
							</div>
						</div>

						<Button
							type="submit"
							class="w-full bg-blue-600 text-white hover:bg-blue-700"
							disabled={submitting}
						>
							{#if submitting}
								<IconLoader class="mr-2 h-4 w-4 animate-spin" />
								กำลังบันทึก...
							{:else}
								บันทึกรหัสผ่านใหม่
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
