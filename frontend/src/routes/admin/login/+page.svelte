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
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		IconLoader,
		IconEye,
		IconEyeOff,
		IconShield,
		IconAlertTriangle,
		IconKey
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let showPassword = $state(false);
	let submitting = $state(false);

	const isDevelopment = import.meta.env.DEV;

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;

		try {
			const result = await auth.login({
				email,
				password,
				remember_me: rememberMe
			});

			// Check if user has admin role
			if (!result.user.admin_role) {
				toast.error('บัญชีนี้ไม่มีสิทธิ์เข้าถึง Admin Portal');
				return;
			}

			authStore.setUser(result.user);
			toast.success('เข้าสู่ระบบสำเร็จ');

			const redirectTo = $page.url.searchParams.get('redirectTo');
			await goto(redirectTo || '/admin');
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 401) {
					toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
				} else if (err.status === 403) {
					toast.error('บัญชีนี้ถูกระงับการใช้งาน');
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

<MetaTags title="เข้าสู่ระบบผู้ดูแลระบบ" description="Admin login portal for Trackivity system" />

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12 sm:px-6 lg:px-8 dark:from-gray-900 dark:to-blue-900"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
				<IconShield class="h-8 w-8 text-white" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Admin Portal</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				เข้าสู่ระบบจัดการสำหรับผู้ดูแลระบบ
			</p>
		</div>

		<Card class="w-full">
			<CardHeader class="space-y-1">
				<CardTitle class="flex items-center justify-center gap-2 text-center text-2xl">
					<IconKey class="h-5 w-5" />
					Admin Login
				</CardTitle>
				<CardDescription class="text-center">สำหรับผู้ดูแลระบบเท่านั้น</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="email">อีเมล</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="admin@example.com"
							disabled={submitting}
							class="w-full"
							required
						/>
					</div>

					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="password">รหัสผ่าน</Label>
							<a
								href="/forgot-password"
								class="text-sm font-medium text-blue-600 hover:text-blue-500"
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

					<Button type="submit" class="w-full bg-blue-600 hover:bg-blue-700" disabled={submitting}>
						{#if submitting}
							<IconLoader class="mr-2 h-4 w-4 animate-spin" />
							กำลังเข้าสู่ระบบ...
						{:else}
							<IconShield class="mr-2 h-4 w-4" />
							เข้าสู่ระบบ Admin
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
					<div class="text-center">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							นักเรียน?
							<a
								href="/login"
								class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
							>
								เข้าสู่ระบบนักเรียน
							</a>
						</p>
					</div>
				</div>

				{#if isDevelopment}
					<Alert>
						<IconAlertTriangle class="h-4 w-4" />
						<AlertDescription>
							<div class="space-y-2">
								<p class="text-sm font-medium">Development Mode - Default Admin:</p>
								<p class="font-mono text-xs">Email: admin@trackivity.local</p>
								<p class="font-mono text-xs">Password: admin123!</p>
								<p class="text-xs text-orange-600">⚠️ Change password after first login!</p>
							</div>
						</AlertDescription>
					</Alert>
				{/if}
			</CardContent>
		</Card>

		<div class="text-center text-xs text-gray-500 dark:text-gray-400">
			<p>© 2025 Trackivity Admin System. All rights reserved.</p>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
	}
	:global(.dark body) {
		background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
	}
</style>
