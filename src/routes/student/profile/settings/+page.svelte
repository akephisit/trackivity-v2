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
	import { IconUser, IconLock, IconMail, IconSchool } from '@tabler/icons-svelte';

	let { data } = $props();
	let isChangingPassword = $state(false);
	let isUpdatingProfile = $state(false);

	// Form states
	let profileForm = $state({
		first_name: data.user?.first_name || '',
		last_name: data.user?.last_name || '',
		email: data.user?.email || ''
	});

	let passwordForm = $state({
		current_password: '',
		new_password: '',
		confirm_password: ''
	});

	async function handleProfileUpdate() {
		isUpdatingProfile = true;
		try {
			const response = await fetch('/api/profile/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(profileForm)
			});

			const result = await response.json();

			if (response.ok) {
				toast.success('อัปเดตข้อมูลส่วนตัวสำเร็จ');
			} else {
				toast.error(result.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
			}
		} catch (error) {
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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
			const response = await fetch('/api/profile/change-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(passwordForm)
			});

			const result = await response.json();

			if (response.ok) {
				toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
				passwordForm = {
					current_password: '',
					new_password: '',
					confirm_password: ''
				};
			} else {
				toast.error(result.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
			}
		} catch (error) {
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			isChangingPassword = false;
		}
	}
</script>

<svelte:head>
	<title>ตั้งค่าบัญชี - Trackivity Student</title>
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
					<p class="text-sm font-medium flex items-center gap-2">
						<IconSchool class="size-4" />
						นักศึกษา
					</p>
				</div>
				{#if data.user?.student_id}
					<div>
						<Label class="text-sm font-medium text-muted-foreground">รหัสนักศึกษา</Label>
						<p class="text-sm font-medium">{data.user.student_id}</p>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>