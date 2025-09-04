<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { currentUser, auth } from '$lib/stores/auth';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		IconUser,
		IconMail,
		IconSchool,
		IconEdit,
		IconCheck,
		IconX,
		IconAlertCircle,
		IconShield,
		IconCalendar,
		IconPhone,
		IconMapPin,
		IconLock,
		IconKey,
		IconEye,
		IconEyeOff
	} from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// UI State
	let editing = $state(false);
	let profileSubmitting = $state(false);
	let passwordSubmitting = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Form data for profile editing
	let profileFormData = $state({
		first_name: data.user?.first_name || '',
		last_name: data.user?.last_name || '',
		email: data.user?.email || '',
		phone: '',
		address: ''
	});

	// Form data for password change
	let passwordFormData = $state({
		current_password: '',
		new_password: '',
		confirm_password: ''
	});

	// Update form data when user data changes
	$effect(() => {
		if (data.user && !editing) {
			profileFormData = {
				first_name: data.user.first_name,
				last_name: data.user.last_name,
				email: data.user.email,
				phone: '', // Will be added to schema later
				address: '' // Will be added to schema later
			};
		}
	});

	// Handle form responses
	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'บันทึกสำเร็จ');
			editing = false;
			passwordFormData = {
				current_password: '',
				new_password: '',
				confirm_password: ''
			};
			// Refresh user session
			auth.validateSession();
			invalidate('profile:data');
		} else if (form?.error) {
			toast.error(form.message || form.error);
		}
	});

	function startEdit() {
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		// Reset form to original values
		if (data.user) {
			profileFormData = {
				first_name: data.user.first_name,
				last_name: data.user.last_name,
				email: data.user.email,
				phone: '',
				address: ''
			};
		}
	}

	function formatDate(dateString?: string): string {
		if (!dateString) return 'ไม่ระบุ';
		return new Date(dateString).toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function isProfileFormValid(): boolean {
		return !!(
			profileFormData.first_name.trim() &&
			profileFormData.last_name.trim() &&
			profileFormData.email.trim()
		);
	}

	function isPasswordFormValid(): boolean {
		return !!(
			passwordFormData.current_password &&
			passwordFormData.new_password &&
			passwordFormData.confirm_password &&
			passwordFormData.new_password === passwordFormData.confirm_password &&
			passwordFormData.new_password.length >= 6
		);
	}

	function getFieldError(field: string): string | undefined {
		return (form as any)?.fieldErrors?.[field]?.[0];
	}
</script>

<svelte:head>
	<title>โปรไฟล์ - Trackivity Student</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="max-w-4xl space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold lg:text-3xl">โปรไฟล์ของฉัน</h1>
			<p class="text-muted-foreground">จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชี</p>
		</div>
	</div>

	{#if data.user}
		<Tabs value="profile" class="space-y-6">
			<TabsList class="grid w-full grid-cols-2">
				<TabsTrigger value="profile" class="flex items-center gap-2">
					<IconUser class="size-4" />
					โปรไฟล์
				</TabsTrigger>
				<TabsTrigger value="security" class="flex items-center gap-2">
					<IconShield class="size-4" />
					ความปลอดภัย
				</TabsTrigger>
			</TabsList>

			<!-- Profile Tab -->
			<TabsContent value="profile" class="space-y-6">
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Basic Information -->
					<Card>
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="flex items-center gap-2">
									<IconUser class="size-5" />
									ข้อมูลพื้นฐาน
								</CardTitle>
								{#if !editing}
									<Button size="sm" variant="outline" onclick={startEdit}>
										<IconEdit class="mr-1 size-3" />
										แก้ไข
									</Button>
								{/if}
							</div>
						</CardHeader>
						<CardContent>
							{#if editing}
								<!-- Profile Edit Form -->
								<form
									method="POST"
									action="?/updateProfile"
									use:enhance={({ formData }) => {
										profileSubmitting = true;
										// Update form data
										formData.set('first_name', profileFormData.first_name);
										formData.set('last_name', profileFormData.last_name);
										formData.set('email', profileFormData.email);
										formData.set('phone', profileFormData.phone);
										formData.set('address', profileFormData.address);
										return async ({ update }) => {
											await update();
											profileSubmitting = false;
										};
									}}
									class="space-y-4"
								>
									<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<div class="space-y-2">
											<Label for="first_name">ชื่อ</Label>
											<Input
												id="first_name"
												bind:value={profileFormData.first_name}
												placeholder="กรอกชื่อ"
												class={getFieldError('first_name') ? 'border-destructive' : ''}
											/>
											{#if getFieldError('first_name')}
												<p class="text-sm text-destructive">{getFieldError('first_name')}</p>
											{/if}
										</div>
										<div class="space-y-2">
											<Label for="last_name">นามสกุล</Label>
											<Input
												id="last_name"
												bind:value={profileFormData.last_name}
												placeholder="กรอกนามสกุล"
												class={getFieldError('last_name') ? 'border-destructive' : ''}
											/>
											{#if getFieldError('last_name')}
												<p class="text-sm text-destructive">{getFieldError('last_name')}</p>
											{/if}
										</div>
									</div>

									<div class="space-y-2">
										<Label for="email">อีเมล</Label>
										<Input
											id="email"
											type="email"
											bind:value={profileFormData.email}
											placeholder="กรอกอีเมล"
											class={getFieldError('email') ? 'border-destructive' : ''}
										/>
										{#if getFieldError('email')}
											<p class="text-sm text-destructive">{getFieldError('email')}</p>
										{/if}
									</div>

									<div class="space-y-2">
										<Label for="phone">เบอร์โทรศัพท์</Label>
										<Input
											id="phone"
											type="tel"
											bind:value={profileFormData.phone}
											placeholder="กรอกเบอร์โทรศัพท์ (ไม่บังคับ)"
										/>
									</div>

									<div class="space-y-2">
										<Label for="address">ที่อยู่</Label>
										<Input
											id="address"
											bind:value={profileFormData.address}
											placeholder="กรอกที่อยู่ (ไม่บังคับ)"
										/>
									</div>

									{#if form?.error && !(form as any)?.fieldErrors}
										<Alert variant="destructive">
											<IconAlertCircle class="size-4" />
											<AlertDescription>{form.message || form.error}</AlertDescription>
										</Alert>
									{/if}

									<div class="flex gap-2">
										<Button
											type="submit"
											disabled={profileSubmitting || !isProfileFormValid()}
											class="flex-1"
										>
											{#if profileSubmitting}
												กำลังบันทึก...
											{:else}
												<IconCheck class="mr-2 size-4" />
												บันทึก
											{/if}
										</Button>
										<Button type="button" variant="outline" onclick={cancelEdit} class="flex-1">
											<IconX class="mr-2 size-4" />
											ยกเลิก
										</Button>
									</div>
								</form>
							{:else}
								<!-- Profile View -->
								<div class="space-y-4">
									<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<div>
											<span class="text-sm text-muted-foreground">ชื่อ</span>
											<p class="font-medium">{data.user.first_name}</p>
										</div>
										<div>
											<span class="text-sm text-muted-foreground">นามสกุล</span>
											<p class="font-medium">{data.user.last_name}</p>
										</div>
									</div>

									<div>
										<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
											<IconMail class="size-3" />
											อีเมล
										</span>
										<p class="font-medium">{data.user.email}</p>
									</div>

									<!-- Placeholder for future fields -->
									<div>
										<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
											<IconPhone class="size-3" />
											เบอร์โทรศัพท์
										</span>
										<p class="text-muted-foreground">ไม่ได้ระบุ</p>
									</div>

									<div>
										<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
											<IconMapPin class="size-3" />
											ที่อยู่
										</span>
										<p class="text-muted-foreground">ไม่ได้ระบุ</p>
									</div>
								</div>
							{/if}
						</CardContent>
					</Card>

					<!-- Student Information -->
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<IconSchool class="size-5" />
								ข้อมูลนักศึกษา
							</CardTitle>
						</CardHeader>
						<CardContent class="space-y-4">
							<div>
								<span class="text-sm text-muted-foreground">รหัสนักศึกษา</span>
								<p class="text-lg font-medium">{data.user.student_id}</p>
							</div>

							<div>
								<span class="text-sm text-muted-foreground">คำนำหน้าชื่อ</span>
								<p class="font-medium">{data.user.prefix || 'ไม่ระบุ'}</p>
							</div>

							{#if $currentUser?.organization_name}
								<div>
									<span class="text-sm text-muted-foreground">หน่วยงาน</span>
									<p class="font-medium">{$currentUser.organization_name}</p>
								</div>
							{/if}

							{#if $currentUser?.department_name}
								<div>
									<span class="text-sm text-muted-foreground">ภาควิชา</span>
									<p class="font-medium">{$currentUser.department_name}</p>
								</div>
							{/if}

							<Separator />

							<div>
								<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
									<IconCalendar class="size-3" />
									วันที่สมัครสมาชิก
								</span>
								<p class="font-medium">{formatDate(data.user.created_at?.toString())}</p>
							</div>

							{#if data.user.updated_at}
								<div>
									<span class="text-sm text-muted-foreground">อัพเดตล่าสุด</span>
									<p class="text-sm">{formatDate(data.user.updated_at?.toString())}</p>
								</div>
							{/if}
						</CardContent>
					</Card>
				</div>

				<!-- Account Status -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<IconShield class="size-5" />
							สถานะบัญชี
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div class="rounded-lg border p-4 text-center">
								<Badge
									variant={data.user.status === 'active' ? 'default' : 'destructive'}
									class="mb-2"
								>
									{data.user.status === 'active' ? 'ใช้งานปกติ' : 'ไม่ใช้งาน'}
								</Badge>
								<p class="text-sm text-muted-foreground">สถานะบัญชี</p>
							</div>

							<div class="rounded-lg border p-4 text-center">
								<Badge variant="secondary" class="mb-2">นักศึกษา</Badge>
								<p class="text-sm text-muted-foreground">ระดับผู้ใช้</p>
							</div>

							<div class="rounded-lg border p-4 text-center">
								<Badge variant="outline" class="mb-2">
									{$currentUser?.permissions?.length || 0}
								</Badge>
								<p class="text-sm text-muted-foreground">สิทธิ์การใช้งาน</p>
							</div>

							<div class="rounded-lg border p-4 text-center">
								<Badge variant="outline" class="mb-2">เข้ารหัสแล้ว</Badge>
								<p class="text-sm text-muted-foreground">ความปลอดภัย</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</TabsContent>

			<!-- Security Tab -->
			<TabsContent value="security" class="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<IconLock class="size-5" />
							เปลี่ยนรหัสผ่าน
						</CardTitle>
						<p class="text-sm text-muted-foreground">
							รหัสผ่านควรมีความยาวอย่างน้อย 6 ตัวอักษร และผสมตัวอักษร ตัวเลข และสัญลักษณ์
						</p>
					</CardHeader>
					<CardContent>
						<form
							method="POST"
							action="?/changePassword"
							use:enhance={({ formData, cancel }) => {
								passwordSubmitting = true;
								// Update form data
								formData.set('current_password', passwordFormData.current_password);
								formData.set('new_password', passwordFormData.new_password);
								formData.set('confirm_password', passwordFormData.confirm_password);
								return async ({ update }) => {
									await update();
									passwordSubmitting = false;
								};
							}}
							class="max-w-md space-y-4"
						>
							<div class="space-y-2">
								<Label for="current_password">รหัสผ่านปัจจุบัน</Label>
								<div class="relative">
									<Input
										id="current_password"
										type={showCurrentPassword ? 'text' : 'password'}
										bind:value={passwordFormData.current_password}
										placeholder="กรอกรหัสผ่านปัจจุบัน"
										class={getFieldError('current_password') ? 'border-destructive pr-10' : 'pr-10'}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
										onclick={() => (showCurrentPassword = !showCurrentPassword)}
									>
										{#if showCurrentPassword}
											<IconEyeOff class="size-4" />
										{:else}
											<IconEye class="size-4" />
										{/if}
									</Button>
								</div>
								{#if getFieldError('current_password')}
									<p class="text-sm text-destructive">{getFieldError('current_password')}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="new_password">รหัสผ่านใหม่</Label>
								<div class="relative">
									<Input
										id="new_password"
										type={showNewPassword ? 'text' : 'password'}
										bind:value={passwordFormData.new_password}
										placeholder="กรอกรหัสผ่านใหม่"
										class={getFieldError('new_password') ? 'border-destructive pr-10' : 'pr-10'}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
										onclick={() => (showNewPassword = !showNewPassword)}
									>
										{#if showNewPassword}
											<IconEyeOff class="size-4" />
										{:else}
											<IconEye class="size-4" />
										{/if}
									</Button>
								</div>
								{#if getFieldError('new_password')}
									<p class="text-sm text-destructive">{getFieldError('new_password')}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="confirm_password">ยืนยันรหัสผ่านใหม่</Label>
								<div class="relative">
									<Input
										id="confirm_password"
										type={showConfirmPassword ? 'text' : 'password'}
										bind:value={passwordFormData.confirm_password}
										placeholder="ยืนยันรหัสผ่านใหม่"
										class={getFieldError('confirm_password') ? 'border-destructive pr-10' : 'pr-10'}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
										onclick={() => (showConfirmPassword = !showConfirmPassword)}
									>
										{#if showConfirmPassword}
											<IconEyeOff class="size-4" />
										{:else}
											<IconEye class="size-4" />
										{/if}
									</Button>
								</div>
								{#if getFieldError('confirm_password')}
									<p class="text-sm text-destructive">{getFieldError('confirm_password')}</p>
								{/if}
								{#if passwordFormData.new_password && passwordFormData.confirm_password && passwordFormData.new_password !== passwordFormData.confirm_password}
									<p class="text-sm text-destructive">รหัสผ่านใหม่และการยืนยันไม่ตรงกัน</p>
								{/if}
							</div>

							{#if form?.error && !(form as any)?.fieldErrors}
								<Alert variant="destructive">
									<IconAlertCircle class="size-4" />
									<AlertDescription>{form.message || form.error}</AlertDescription>
								</Alert>
							{/if}

							<Button
								type="submit"
								disabled={passwordSubmitting || !isPasswordFormValid()}
								class="w-full"
							>
								{#if passwordSubmitting}
									กำลังเปลี่ยนรหัสผ่าน...
								{:else}
									<IconKey class="mr-2 size-4" />
									เปลี่ยนรหัสผ่าน
								{/if}
							</Button>
						</form>
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>

		<!-- Privacy Notice -->
		<Card class="border-muted bg-muted/30">
			<CardContent class="p-4">
				<div class="flex items-start gap-3">
					<IconShield class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div class="space-y-1">
						<h3 class="text-sm font-medium">ข้อมูลส่วนบุคคล</h3>
						<p class="text-xs text-muted-foreground">
							ข้อมูลส่วนบุคคลของคุณได้รับการป้องกันตามนโยบายของมหาวิทยาลัย
							เราจะไม่เปิดเผยข้อมูลของคุณให้บุคคลที่สามโดยไม่ได้รับความยินยอมจากคุณ
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	{:else}
		<!-- Loading State -->
		<Card>
			<CardHeader>
				<CardTitle>
					<Skeleton class="h-6 w-32" />
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					{#each Array(4) as _}
						<div class="space-y-2">
							<Skeleton class="h-4 w-20" />
							<Skeleton class="h-10 w-full" />
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
