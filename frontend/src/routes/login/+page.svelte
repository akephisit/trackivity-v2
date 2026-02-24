<script lang="ts">
	import { auth, ApiError } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
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
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		IconLoader,
		IconEye,
		IconEyeOff,
		IconUser,
		IconSchool
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';

	let studentId = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let showPassword = $state(false);
	let submitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;

		try {
			const result = await auth.login({
				student_id: studentId.includes('@') ? undefined : studentId,
				email: studentId.includes('@') ? studentId : undefined,
				password,
				remember_me: rememberMe
			});

			authStore.setUser(result.user);
			toast.success('เข้าสู่ระบบสำเร็จ');

			const redirectTo = $page.url.searchParams.get('redirectTo');
			const destination = redirectTo || (result.user.admin_role ? '/admin' : '/student');
			await goto(destination);
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 401) {
					toast.error('รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง');
				} else if (err.status === 403) {
					toast.error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแล');
				} else {
					toast.error(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
				}
			} else {
				toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<MetaTags title="เข้าสู่ระบบ" description="เข้าสู่ระบบสำหรับนักศึกษา" />

<div
	class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600"
			>
				<IconSchool class="h-8 w-8 text-white" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Trackivity</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">เข้าสู่ระบบสำหรับนักเรียน</p>
		</div>

		<Card class="w-full">
			<CardHeader class="space-y-1">
				<CardTitle class="flex items-center justify-center gap-2 text-center text-2xl">
					<IconUser class="h-5 w-5" />
					เข้าสู่ระบบ
				</CardTitle>
				<CardDescription class="text-center">สำหรับนักเรียนและผู้เข้าร่วมกิจกรรม</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="student_id">รหัสนักศึกษา</Label>
						<Input
							id="student_id"
							type="text"
							bind:value={studentId}
							placeholder="64123456789"
							disabled={submitting}
							class="w-full"
							maxlength={12}
							required
						/>
					</div>

					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="password">รหัสผ่าน</Label>
							<a
								href="/forgot-password"
								class="text-sm font-medium text-green-600 hover:text-green-500"
							>
								ลืมรหัสผ่าน?
							</a>
						</div>
						<div class="relative">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								placeholder="รหัสผ่านของคุณ"
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

					<div class="flex items-center space-x-2">
						<Checkbox id="remember_me" bind:checked={rememberMe} disabled={submitting} />
						<Label for="remember_me" class="text-sm">จดจำการเข้าสู่ระบบ (30 วัน)</Label>
					</div>

					<Button type="submit" class="w-full" disabled={submitting}>
						{#if submitting}
							<IconLoader class="mr-2 h-4 w-4 animate-spin" />
							กำลังเข้าสู่ระบบ...
						{:else}
							เข้าสู่ระบบ
						{/if}
					</Button>
				</form>

				<div class="space-y-3">
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<span class="w-full border-t"></span>
						</div>
						<div class="relative flex justify-center text-xs uppercase">
							<span class="bg-background px-2 text-muted-foreground">หรือ</span>
						</div>
					</div>

					<div class="space-y-2 text-center">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							ยังไม่มีบัญชี?
							<a href="/register" class="font-medium text-green-600 hover:text-green-500">
								สมัครสมาชิก
							</a>
						</p>
						<p class="text-sm text-gray-600 dark:text-gray-400">
							ผู้ดูแลระบบ?
							<a href="/admin/login" class="font-medium text-blue-600 hover:text-blue-500">
								เข้าสู่ระบบ Admin
							</a>
						</p>
					</div>
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
