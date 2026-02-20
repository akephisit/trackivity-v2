<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { IconUser, IconLock, IconMail } from '@tabler/icons-svelte';
	import { usersApi, auth as authApi, ApiError } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';

	let user = $state(authStore.user);

	let isChangingPassword = $state(false);
	let isUpdatingProfile = $state(false);

	// Form states
	let profileForm = $state({
		first_name: user?.first_name || '',
		last_name: user?.last_name || '',
		email: user?.email || ''
	});

	let passwordForm = $state({
		current_password: '',
		new_password: '',
		confirm_password: ''
	});

	async function handleProfileUpdate() {
		isUpdatingProfile = true;
		try {
			await usersApi.updateProfile({
				first_name: profileForm.first_name,
				last_name: profileForm.last_name,
			});
			toast.success('อัปเดตข้อมูลส่วนตัวสำเร็จ');
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			toast.error(msg);
		} finally {
			isUpdatingProfile = false;
		}
	}

	async function handlePasswordChange() {
		if (passwordForm.new_password !== passwordForm.confirm_password) {
			toast.error('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
			return;
		}
		if (passwordForm.new_password.length < 6) {
			toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
			return;
		}
		isChangingPassword = true;
		try {
			await usersApi.changePassword(passwordForm.current_password, passwordForm.new_password);
			toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
			passwordForm = { current_password: '', new_password: '', confirm_password: '' };
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			toast.error(msg);
		} finally {
			isChangingPassword = false;
		}
	}
</script>

<svelte:head>
	<title>ตั้งค่าบัญชี - Trackivity Admin</title>
</svelte:head>

<div class="container mx-auto max-w-4xl space-y-6">
	<div class="flex items-center space-x-2">
		<IconUser class="size-6" />
		<h1 class="text-2xl font-bold">ตั้งค่าบัญชี</h1>
	</div>

	<div class="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
		<!-- ข้อมูลส่วนตัว -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconUser class="size-5" />
					ข้อมูลส่วนตัว
				</CardTitle>
				<CardDescription>จัดการข้อมูลส่วนตัวของคุณ</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid gap-4">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="first_name">ชื่อ</Label>
							<Input
								id="first_name"
								bind:value={profileForm.first_name}
								placeholder="กรุณากรอกชื่อ"
								disabled={isUpdatingProfile}
							/>
						</div>
						<div class="space-y-2">
							<Label for="last_name">นามสกุล</Label>
							<Input
								id="last_name"
								bind:value={profileForm.last_name}
								placeholder="กรุณากรอกนามสกุล"
								disabled={isUpdatingProfile}
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="email" class="flex items-center gap-2">
							<IconMail class="size-4" />
							อีเมล
						</Label>
						<Input
							id="email"
							type="email"
							bind:value={profileForm.email}
							placeholder="กรุณากรอกอีเมล"
							disabled={isUpdatingProfile}
						/>
					</div>
				</div>

				<Button onclick={handleProfileUpdate} disabled={isUpdatingProfile} class="w-full">
					{isUpdatingProfile ? 'กำลังอัปเดต...' : 'บันทึกข้อมูล'}
				</Button>
			</CardContent>
		</Card>

		<!-- เปลี่ยนรหัสผ่าน -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<IconLock class="size-5" />
					เปลี่ยนรหัสผ่าน
				</CardTitle>
				<CardDescription>เปลี่ยนรหัสผ่านสำหรับความปลอดภัย</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-4">
					<div class="space-y-2">
						<Label for="current_password">รหัสผ่านปัจจุบัน</Label>
						<Input
							id="current_password"
							type="password"
							bind:value={passwordForm.current_password}
							placeholder="กรุณากรอกรหัสผ่านปัจจุบัน"
							disabled={isChangingPassword}
						/>
					</div>
					<div class="space-y-2">
						<Label for="new_password">รหัสผ่านใหม่</Label>
						<Input
							id="new_password"
							type="password"
							bind:value={passwordForm.new_password}
							placeholder="กรุณากรอกรหัสผ่านใหม่"
							disabled={isChangingPassword}
						/>
					</div>
					<div class="space-y-2">
						<Label for="confirm_password">ยืนยันรหัสผ่านใหม่</Label>
						<Input
							id="confirm_password"
							type="password"
							bind:value={passwordForm.confirm_password}
							placeholder="กรุณากรอกรหัสผ่านใหม่อีกครั้ง"
							disabled={isChangingPassword}
						/>
					</div>
				</div>

				<Button onclick={handlePasswordChange} disabled={isChangingPassword} class="w-full">
					{isChangingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
				</Button>
			</CardContent>
		</Card>
	</div>

	<!-- ข้อมูลบัญชี -->
	<Card>
		<CardHeader>
			<CardTitle>ข้อมูลบัญชี</CardTitle>
			<CardDescription>ข้อมูลเกี่ยวกับบัญชีของคุณ</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-2">
				<div>
					<Label class="text-sm font-medium text-muted-foreground">ประเภทผู้ใช้</Label>
					<p class="text-sm font-medium">{authStore.user?.admin_role?.admin_level || 'ไม่ทราบ'}</p>
				</div>
				{#if authStore.user}
					<div>
						<Label class="text-sm font-medium text-muted-foreground">หน่วยงาน</Label>
						<p class="text-sm font-medium">{authStore.user?.organization_name ?? '-'}</p>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>