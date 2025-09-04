<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser, auth } from '$lib/stores/auth';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
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
		IconKey,
		IconEye,
		IconEyeOff
	} from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';
	import { apiClient, isApiSuccess } from '$lib/api/client';
	import { profileUpdateSchema, changePasswordSchema, PrefixOptions } from '$lib/schemas/auth';
	import type { ProfileUpdateFormData, ChangePasswordFormData } from '$lib/schemas/auth';

	let editing = $state(false);
	let showPasswordForm = $state(false);
	let loading = $state(false);
	let passwordLoading = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);
	let error: string | null = $state(null);
	let passwordError: string | null = $state(null);
	let fieldErrors: Record<string, string[]> = $state({});
	let passwordFieldErrors: Record<string, string[]> = $state({});

	// Form data
	let formData: ProfileUpdateFormData = $state({
		prefix: '',
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		address: ''
	});

	// Password form data
	let passwordData: ChangePasswordFormData = $state({
		current_password: '',
		new_password: '',
		confirm_password: ''
	});

	onMount(() => {
		initializeFormData();
	});

	// Watch for user changes
	$effect(() => {
		if ($currentUser && !editing) {
			initializeFormData();
		}
	});

	function initializeFormData() {
		if ($currentUser) {
			formData = {
				prefix: $currentUser.prefix || '',
				first_name: $currentUser.first_name || '',
				last_name: $currentUser.last_name || '',
				email: $currentUser.email || '',
				phone: $currentUser.phone || '',
				address: $currentUser.address || ''
			};
		}
	}

	function startEdit() {
		editing = true;
		error = null;
		fieldErrors = {};
	}

	function cancelEdit() {
		editing = false;
		error = null;
		fieldErrors = {};
		initializeFormData();
	}

	function startPasswordChange() {
		showPasswordForm = true;
		passwordError = null;
		passwordFieldErrors = {};
		passwordData = {
			current_password: '',
			new_password: '',
			confirm_password: ''
		};
	}

	function cancelPasswordChange() {
		showPasswordForm = false;
		passwordError = null;
		passwordFieldErrors = {};
		passwordData = {
			current_password: '',
			new_password: '',
			confirm_password: ''
		};
		showCurrentPassword = false;
		showNewPassword = false;
		showConfirmPassword = false;
	}

	async function saveProfile() {
		if (!$currentUser) return;

		loading = true;
		error = null;
		fieldErrors = {};

		try {
			// Validate form data
			const validation = profileUpdateSchema.safeParse(formData);
			if (!validation.success) {
				const errors: Record<string, string[]> = {};
				validation.error.errors.forEach((err) => {
					const field = err.path.join('.');
					if (!errors[field]) {
						errors[field] = [];
					}
					errors[field].push(err.message);
				});
				fieldErrors = errors;
				error = 'กรุณาตรวจสอบข้อมูลที่ป้อน';
				return;
			}

			// Update profile via API
			const response = await apiClient.updateStudentProfile(formData);

			if (isApiSuccess(response)) {
				toast.success('บันทึกข้อมูลส่วนตัวสำเร็จ');
				editing = false;
				// Refresh user data
				await auth.validateSession();
			} else {
				if (response.error?.field_errors) {
					fieldErrors = response.error.field_errors;
				}
				error = response.error?.message || 'ไม่สามารถบันทึกข้อมูลได้';
			}
		} catch (err: any) {
			console.error('Failed to update profile:', err);
			if (err.code === 'VALIDATION_ERROR' && err.details?.field_errors) {
				fieldErrors = err.details.field_errors;
			}
			error = err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง';
		} finally {
			loading = false;
		}
	}

	async function changePassword() {
		passwordLoading = true;
		passwordError = null;
		passwordFieldErrors = {};

		try {
			// Validate password data
			const validation = changePasswordSchema.safeParse(passwordData);
			if (!validation.success) {
				const errors: Record<string, string[]> = {};
				validation.error.errors.forEach((err) => {
					const field = err.path.join('.');
					if (!errors[field]) {
						errors[field] = [];
					}
					errors[field].push(err.message);
				});
				passwordFieldErrors = errors;
				passwordError = 'กรุณาตรวจสอบข้อมูลที่ป้อน';
				return;
			}

			// Change password via API
			const response = await apiClient.changeStudentPassword(passwordData);

			if (isApiSuccess(response)) {
				toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
				cancelPasswordChange();
			} else {
				if (response.error?.field_errors) {
					passwordFieldErrors = response.error.field_errors;
				}
				passwordError = response.error?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
			}
		} catch (err: any) {
			console.error('Failed to change password:', err);
			if (err.code === 'VALIDATION_ERROR' && err.details?.field_errors) {
				passwordFieldErrors = err.details.field_errors;
			}
			passwordError = err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองอีกครั้ง';
		} finally {
			passwordLoading = false;
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

	function getPrefixLabel(prefixValue?: string): string {
		if (!prefixValue) return 'ไม่ระบุ';
		const prefix = PrefixOptions.find(p => p.value === prefixValue);
		return prefix ? prefix.label : 'ไม่ระบุ';
	}

	function getFieldError(fieldName: string, errors: Record<string, string[]>): string {
		return errors[fieldName]?.[0] || '';
	}

	function isFormValid(): boolean {
		return !!(
			formData.prefix && 
			formData.prefix.trim() !== '' &&
			formData.first_name && 
			formData.first_name.trim() !== '' &&
			formData.last_name && 
			formData.last_name.trim() !== '' &&
			formData.email && 
			formData.email.trim() !== ''
		);
	}

	function isPasswordFormValid(): boolean {
		return !!(passwordData.current_password && passwordData.new_password && passwordData.confirm_password);
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

		{#if !editing && !showPasswordForm}
			<div class="flex gap-2">
				<Button onclick={startEdit} variant="outline" class="w-full sm:w-auto">
					<IconEdit class="mr-2 size-4" />
					แก้ไขข้อมูล
				</Button>
				<Button onclick={startPasswordChange} variant="secondary" class="w-full sm:w-auto">
					<IconKey class="mr-2 size-4" />
					เปลี่ยนรหัสผ่าน
				</Button>
			</div>
		{/if}
	</div>

	{#if $currentUser}
		<!-- Profile Info -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Basic Information -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<IconUser class="size-5" />
						ข้อมูลพื้นฐาน
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if editing}
						<!-- Edit Mode -->
						<div class="space-y-4">
							<!-- Prefix Selection -->
							<div class="space-y-2">
								<Label for="prefix">คำนำหน้า <span class="text-red-500">*</span></Label>
								<Select.Root type="single" bind:value={formData.prefix}>
									<Select.Trigger class={getFieldError('prefix', fieldErrors) ? 'border-red-500' : ''}>
										{PrefixOptions.find((opt) => opt.value === formData.prefix)?.label ?? 'เลือกคำนำหน้า'}
									</Select.Trigger>
									<Select.Content>
										{#each PrefixOptions as option}
											<Select.Item value={option.value}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								{#if getFieldError('prefix', fieldErrors)}
									<p class="text-sm text-red-500">{getFieldError('prefix', fieldErrors)}</p>
								{/if}
							</div>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="first_name">ชื่อ <span class="text-red-500">*</span></Label>
									<Input 
										id="first_name" 
										bind:value={formData.first_name} 
										placeholder="กรอกชื่อ"
										class={getFieldError('first_name', fieldErrors) ? 'border-red-500' : ''}
									/>
									{#if getFieldError('first_name', fieldErrors)}
										<p class="text-sm text-red-500">{getFieldError('first_name', fieldErrors)}</p>
									{/if}
								</div>
								<div class="space-y-2">
									<Label for="last_name">นามสกุล <span class="text-red-500">*</span></Label>
									<Input 
										id="last_name" 
										bind:value={formData.last_name} 
										placeholder="กรอกนามสกุล"
										class={getFieldError('last_name', fieldErrors) ? 'border-red-500' : ''}
									/>
									{#if getFieldError('last_name', fieldErrors)}
										<p class="text-sm text-red-500">{getFieldError('last_name', fieldErrors)}</p>
									{/if}
								</div>
							</div>

							<div class="space-y-2">
								<Label for="email">อีเมล <span class="text-red-500">*</span></Label>
								<Input
									id="email"
									type="email"
									bind:value={formData.email}
									placeholder="กรอกอีเมล"
									class={getFieldError('email', fieldErrors) ? 'border-red-500' : ''}
								/>
								{#if getFieldError('email', fieldErrors)}
									<p class="text-sm text-red-500">{getFieldError('email', fieldErrors)}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="phone">เบอร์โทรศัพท์</Label>
								<Input
									id="phone"
									type="tel"
									bind:value={formData.phone}
									placeholder="กรอกเบอร์โทรศัพท์ (ไม่บังคับ) เช่น 0812345678"
									class={getFieldError('phone', fieldErrors) ? 'border-red-500' : ''}
								/>
								{#if getFieldError('phone', fieldErrors)}
									<p class="text-sm text-red-500">{getFieldError('phone', fieldErrors)}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="address">ที่อยู่</Label>
								<Textarea
									id="address"
									bind:value={formData.address}
									placeholder="กรอกที่อยู่ (ไม่บังคับ)"
									rows={3}
									class={getFieldError('address', fieldErrors) ? 'border-red-500' : ''}
								/>
								{#if getFieldError('address', fieldErrors)}
									<p class="text-sm text-red-500">{getFieldError('address', fieldErrors)}</p>
								{/if}
							</div>

							{#if error}
								<Alert variant="destructive">
									<IconAlertCircle class="size-4" />
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							{/if}

							<div class="flex gap-2">
								<Button onclick={saveProfile} disabled={loading || !isFormValid()} class="flex-1">
									{#if loading}
										กำลังบันทึก...
									{:else}
										<IconCheck class="mr-2 size-4" />
										บันทึก
									{/if}
								</Button>
								<Button variant="outline" onclick={cancelEdit} disabled={loading} class="flex-1">
									<IconX class="mr-2 size-4" />
									ยกเลิก
								</Button>
							</div>
						</div>
					{:else}
						<!-- View Mode -->
						<div class="space-y-4">
							<div>
								<span class="text-sm text-muted-foreground">คำนำหน้า</span>
								<p class="font-medium">{getPrefixLabel($currentUser.prefix)}</p>
							</div>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<span class="text-sm text-muted-foreground">ชื่อ</span>
									<p class="font-medium">{$currentUser.first_name}</p>
								</div>
								<div>
									<span class="text-sm text-muted-foreground">นามสกุล</span>
									<p class="font-medium">{$currentUser.last_name}</p>
								</div>
							</div>

							<div>
								<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
									<IconMail class="size-3" />
									อีเมล
								</span>
								<p class="font-medium">{$currentUser.email}</p>
							</div>

							<div>
								<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
									<IconPhone class="size-3" />
									เบอร์โทรศัพท์
								</span>
								<p class="font-medium">{$currentUser.phone || 'ไม่ได้ระบุ'}</p>
							</div>

							<div>
								<span class="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
									<IconMapPin class="size-3" />
									ที่อยู่
								</span>
								<p class="font-medium break-words">{$currentUser.address || 'ไม่ได้ระบุ'}</p>
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
						<p class="text-lg font-medium">{$currentUser.student_id}</p>
					</div>

					{#if $currentUser.organization_name}
						<div>
							<span class="text-sm text-muted-foreground">หน่วยงาน</span>
							<p class="font-medium">{$currentUser.organization_name}</p>
						</div>
					{/if}

					{#if $currentUser.department_name}
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
						<p class="font-medium">{formatDate($currentUser.created_at)}</p>
					</div>

					{#if $currentUser.updated_at}
						<div>
							<span class="text-sm text-muted-foreground">อัพเดตล่าสุด</span>
							<p class="text-sm">{formatDate($currentUser.updated_at)}</p>
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>

		<!-- Password Change Form -->
		{#if showPasswordForm}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<IconKey class="size-5" />
						เปลี่ยนรหัสผ่าน
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="current_password">รหัสผ่านปัจจุบัน <span class="text-red-500">*</span></Label>
							<div class="relative">
								<Input
									id="current_password"
									type={showCurrentPassword ? 'text' : 'password'}
									bind:value={passwordData.current_password}
									placeholder="กรอกรหัสผ่านปัจจุบัน"
									class={getFieldError('current_password', passwordFieldErrors) ? 'border-red-500' : ''}
								/>
								<Button
									variant="ghost"
									size="sm"
									class="absolute right-0 top-0 h-full px-3"
									onclick={() => showCurrentPassword = !showCurrentPassword}
									type="button"
								>
									{#if showCurrentPassword}
										<IconEyeOff class="size-4" />
									{:else}
										<IconEye class="size-4" />
									{/if}
								</Button>
							</div>
							{#if getFieldError('current_password', passwordFieldErrors)}
								<p class="text-sm text-red-500">{getFieldError('current_password', passwordFieldErrors)}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="new_password">รหัสผ่านใหม่ <span class="text-red-500">*</span></Label>
							<div class="relative">
								<Input
									id="new_password"
									type={showNewPassword ? 'text' : 'password'}
									bind:value={passwordData.new_password}
									placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข)"
									class={getFieldError('new_password', passwordFieldErrors) ? 'border-red-500' : ''}
								/>
								<Button
									variant="ghost"
									size="sm"
									class="absolute right-0 top-0 h-full px-3"
									onclick={() => showNewPassword = !showNewPassword}
									type="button"
								>
									{#if showNewPassword}
										<IconEyeOff class="size-4" />
									{:else}
										<IconEye class="size-4" />
									{/if}
								</Button>
							</div>
							{#if getFieldError('new_password', passwordFieldErrors)}
								<p class="text-sm text-red-500">{getFieldError('new_password', passwordFieldErrors)}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="confirm_password">ยืนยันรหัสผ่านใหม่ <span class="text-red-500">*</span></Label>
							<div class="relative">
								<Input
									id="confirm_password"
									type={showConfirmPassword ? 'text' : 'password'}
									bind:value={passwordData.confirm_password}
									placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
									class={getFieldError('confirm_password', passwordFieldErrors) ? 'border-red-500' : ''}
								/>
								<Button
									variant="ghost"
									size="sm"
									class="absolute right-0 top-0 h-full px-3"
									onclick={() => showConfirmPassword = !showConfirmPassword}
									type="button"
								>
									{#if showConfirmPassword}
										<IconEyeOff class="size-4" />
									{:else}
										<IconEye class="size-4" />
									{/if}
								</Button>
							</div>
							{#if getFieldError('confirm_password', passwordFieldErrors)}
								<p class="text-sm text-red-500">{getFieldError('confirm_password', passwordFieldErrors)}</p>
							{/if}
						</div>

						{#if passwordError}
							<Alert variant="destructive">
								<IconAlertCircle class="size-4" />
								<AlertDescription>{passwordError}</AlertDescription>
							</Alert>
						{/if}

						<div class="flex gap-2">
							<Button onclick={changePassword} disabled={passwordLoading || !isPasswordFormValid()} class="flex-1">
								{#if passwordLoading}
									กำลังเปลี่ยน...
								{:else}
									<IconCheck class="mr-2 size-4" />
									เปลี่ยนรหัสผ่าน
								{/if}
							</Button>
							<Button variant="outline" onclick={cancelPasswordChange} disabled={passwordLoading} class="flex-1">
								<IconX class="mr-2 size-4" />
								ยกเลิก
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		{/if}

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
						<Badge variant="default" class="mb-2">ใช้งานปกติ</Badge>
						<p class="text-sm text-muted-foreground">สถานะบัญชี</p>
					</div>

					<div class="rounded-lg border p-4 text-center">
						<Badge variant="secondary" class="mb-2">นักศึกษา</Badge>
						<p class="text-sm text-muted-foreground">ระดับผู้ใช้</p>
					</div>

					<div class="rounded-lg border p-4 text-center">
						<Badge variant="outline" class="mb-2">
							{$currentUser.permissions?.length || 0}
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

		<!-- Privacy Notice -->
		<Card class="border-muted bg-muted/30">
			<CardContent class="p-4">
				<div class="flex items-start gap-3">
					<IconShield class="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
					<div class="space-y-1">
						<h3 class="text-sm font-medium">ข้อมูลส่วนบุคคล</h3>
						<p class="text-xs text-muted-foreground">
							ข้อมูลส่วนบุคคลของคุณได้รับการป้องกันตามนีสยประปิสย์ของมหาวิทยาลัย
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
