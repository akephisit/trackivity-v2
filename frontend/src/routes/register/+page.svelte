<script lang="ts">
	import { auth as authApi, organizationsApi, ApiError } from '$lib/api';
	import type { Organization, Department } from '$lib/api';
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
	import * as Select from '$lib/components/ui/select';
	import {
		IconLoader,
		IconEye,
		IconEyeOff,
		IconUser,
		IconMail,
		IconLock,
		IconAlertTriangle,
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// ─── Form State ──────────────────────────────────────────────────────────
	let formData = $state({
		student_id: '',
		email: '',
		password: '',
		confirmPassword: '',
		prefix: '',
		first_name: '',
		last_name: '',
		phone: '',
		organization_id: '',
		department_id: '',
	});

	let errors = $state<Record<string, string>>({});
	let submitting = $state(false);
	let globalError = $state('');

	// ─── UI State ────────────────────────────────────────────────────────────
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let selectedFaculty = $state('');
	let selectedDepartment = $state('');
	let departments = $state<Department[]>([]);
	let loadingDepartments = $state(false);
	let organizations = $state<Organization[]>([]);
	let loadingOrgs = $state(true);

	const prefixOptions = [
		{ value: 'นาย', label: 'นาย' },
		{ value: 'นางสาว', label: 'นางสาว' },
		{ value: 'นาง', label: 'นาง' },
	];

	// Organization options
	let facultyOptions = $derived(
		organizations.map((org) => ({ value: org.id, label: org.name }))
	);

	let departmentOptions = $derived(
		departments.map((dept) => ({ value: dept.id, label: dept.name }))
	);

	onMount(async () => {
		try {
			const result = await organizationsApi.list();
			organizations = result.all;
		} catch (e) {
			console.error('Failed to load organizations:', e);
		} finally {
			loadingOrgs = false;
		}
	});

	// Handle faculty selection
	$effect(() => {
		if (selectedFaculty && selectedFaculty.trim() !== '') {
			formData.organization_id = selectedFaculty;
			selectedDepartment = '';
			formData.department_id = '';
			loadDepartments(selectedFaculty);
		} else {
			formData.organization_id = '';
			selectedDepartment = '';
			formData.department_id = '';
			departments = [];
		}
	});

	// Handle department selection
	$effect(() => {
		if (selectedDepartment && selectedDepartment.trim() !== '') {
			formData.department_id = selectedDepartment;
		} else {
			formData.department_id = '';
		}
	});

	async function loadDepartments(facultyId: string) {
		if (!facultyId) { departments = []; return; }
		loadingDepartments = true;
		try {
			departments = await organizationsApi.departments(facultyId);
		} catch (e) {
			console.warn('Failed to load departments:', e);
			departments = [];
		} finally {
			loadingDepartments = false;
		}
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!formData.prefix) newErrors.prefix = 'กรุณาเลือกคำนำหน้า';
		if (!formData.first_name.trim()) newErrors.first_name = 'กรุณากรอกชื่อจริง';
		if (!formData.last_name.trim()) newErrors.last_name = 'กรุณากรอกนามสกุล';
		if (!formData.student_id.trim()) newErrors.student_id = 'กรุณากรอกรหัสนักศึกษา';
		if (!formData.email.trim()) newErrors.email = 'กรุณากรอกอีเมล';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'อีเมลไม่ถูกต้อง';
		if (!formData.password) newErrors.password = 'กรุณากรอกรหัสผ่าน';
		else if (formData.password.length < 6) newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
		else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
			newErrors.password = 'ต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข';
		}
		if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
		}
		if (!formData.organization_id) newErrors.organization_id = 'กรุณาเลือกหน่วยงาน';

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		globalError = '';

		if (!validate()) return;

		submitting = true;
		try {
			await authApi.register({
				student_id: formData.student_id,
				email: formData.email,
				password: formData.password,
				prefix: formData.prefix,
				first_name: formData.first_name,
				last_name: formData.last_name,
				phone: formData.phone || undefined,
				organization_id: formData.organization_id || undefined,
				department_id: formData.department_id || undefined,
			});
			toast.success('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
			goto('/login');
		} catch (e) {
			if (e instanceof ApiError) {
				if (e.status === 409) {
					globalError = 'รหัสนักศึกษาหรืออีเมลนี้มีอยู่ในระบบแล้ว';
				} else {
					globalError = e.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
				}
			} else {
				globalError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			}
			toast.error(globalError);
		} finally {
			submitting = false;
		}
	}
</script>

<MetaTags title="สมัครสมาชิก" description="สมัครสมาชิกสำหรับนักศึกษา" />

<div class="register-container min-h-screen overflow-y-auto bg-gray-50 dark:bg-gray-900">
	<div class="flex min-h-screen flex-col lg:flex-row">
		<!-- Left Side - Logo/Branding Section -->
		<div
			class="flex items-center justify-center bg-gradient-to-br from-green-600 to-green-700 p-8 lg:w-2/5 lg:p-12 dark:from-green-700 dark:to-green-800"
		>
			<div class="max-w-md text-center lg:text-left">
				<div
					class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 lg:mx-0 lg:h-24 lg:w-24"
				>
					<IconUser class="h-10 w-10 text-white lg:h-12 lg:w-12" />
				</div>
				<h1 class="mb-4 text-4xl font-bold text-white lg:text-5xl">Trackivity</h1>
				<p class="mb-6 text-lg text-green-100 lg:text-xl">ระบบจัดการกิจกรรมนักศึกษา</p>
				<p class="text-green-100/80">
					สมัครสมาชิกเพื่อเริ่มต้นใช้งานระบบและเข้าร่วมกิจกรรมต่างๆ ของมหาวิทยาลัย
				</p>
			</div>
		</div>

		<!-- Right Side - Registration Form -->
		<div
			class="mobile-spacing flex items-start justify-center overflow-y-auto p-4 sm:p-6 lg:w-3/5 lg:items-center lg:p-8"
		>
			<div class="w-full max-w-2xl">
				<div class="mb-6 text-center lg:text-left">
					<h2 class="mb-2 text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
						สมัครสมาชิก
					</h2>
					<p class="text-gray-600 dark:text-gray-400">กรุณากรอกข้อมูลเพื่อสร้างบัญชีนักศึกษาใหม่</p>
				</div>

				<Card class="w-full shadow-lg">
					<CardContent class="space-y-4 p-6 lg:p-8">
						<form onsubmit={handleSubmit} class="space-y-4">
							{#if globalError}
								<Alert variant="destructive">
									<IconAlertTriangle class="h-4 w-4" />
									<AlertDescription>
										<div class="space-y-2">
											<p class="font-medium">เกิดข้อผิดพลาดในการสมัครสมาชิก</p>
											<p class="text-sm">{globalError}</p>
										</div>
									</AlertDescription>
								</Alert>
							{/if}

							<!-- คำนำหน้า -->
							<div class="space-y-1">
								<Label for="prefix" class="flex items-center gap-2">
									<IconUser class="h-4 w-4" />
									คำนำหน้า
								</Label>
								<Select.Root type="single" bind:value={formData.prefix} disabled={submitting}>
									<Select.Trigger id="prefix" class="w-full">
										{prefixOptions.find((o) => o.value === formData.prefix)?.label ?? 'เลือกคำนำหน้า'}
									</Select.Trigger>
									<Select.Content>
										{#each prefixOptions as option}
											<Select.Item value={option.value}>{option.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								{#if errors.prefix}<p class="text-sm text-destructive">{errors.prefix}</p>{/if}
							</div>

							<!-- ชื่อจริงและนามสกุล -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="space-y-1">
									<Label for="first_name" class="flex items-center gap-2">
										<IconUser class="h-4 w-4" />
										ชื่อจริง
									</Label>
									<Input
										id="first_name"
										type="text"
										bind:value={formData.first_name}
										placeholder="ชื่อจริงของคุณ"
										disabled={submitting}
									/>
									{#if errors.first_name}<p class="text-sm text-destructive">{errors.first_name}</p>{/if}
								</div>
								<div class="space-y-1">
									<Label for="last_name" class="flex items-center gap-2">
										<IconUser class="h-4 w-4" />
										นามสกุล
									</Label>
									<Input
										id="last_name"
										type="text"
										bind:value={formData.last_name}
										placeholder="นามสกุลของคุณ"
										disabled={submitting}
									/>
									{#if errors.last_name}<p class="text-sm text-destructive">{errors.last_name}</p>{/if}
								</div>
							</div>

							<!-- รหัสนักศึกษาและอีเมล -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="space-y-1">
									<Label for="student_id" class="flex items-center gap-2">
										<IconUser class="h-4 w-4" />
										รหัสนักศึกษา
									</Label>
									<Input
										id="student_id"
										type="text"
										bind:value={formData.student_id}
										placeholder="64123456789"
										disabled={submitting}
										maxlength={12}
									/>
									{#if errors.student_id}<p class="text-sm text-destructive">{errors.student_id}</p>{/if}
								</div>
								<div class="space-y-1">
									<Label for="email" class="flex items-center gap-2">
										<IconMail class="h-4 w-4" />
										อีเมล
									</Label>
									<Input
										id="email"
										type="email"
										bind:value={formData.email}
										placeholder="your@email.com"
										disabled={submitting}
									/>
									{#if errors.email}<p class="text-sm text-destructive">{errors.email}</p>{/if}
								</div>
							</div>

							<!-- รหัสผ่าน -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="space-y-1">
									<Label for="password" class="flex items-center gap-2">
										<IconLock class="h-4 w-4" />
										รหัสผ่าน
									</Label>
									<div class="relative">
										<Input
											id="password"
											type={showPassword ? 'text' : 'password'}
											bind:value={formData.password}
											placeholder="รหัสผ่านของคุณ"
											disabled={submitting}
											class="pr-10"
										/>
										<button
											type="button"
											onclick={() => showPassword = !showPassword}
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
									{#if errors.password}<p class="text-sm text-destructive">{errors.password}</p>{/if}
								</div>
								<div class="space-y-1">
									<Label for="confirm_password" class="flex items-center gap-2">
										<IconLock class="h-4 w-4" />
										ยืนยันรหัสผ่าน
									</Label>
									<div class="relative">
										<Input
											id="confirm_password"
											type={showConfirmPassword ? 'text' : 'password'}
											bind:value={formData.confirmPassword}
											placeholder="ยืนยันรหัสผ่านของคุณ"
											disabled={submitting}
											class="pr-10"
										/>
										<button
											type="button"
											onclick={() => showConfirmPassword = !showConfirmPassword}
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
									{#if errors.confirmPassword}<p class="text-sm text-destructive">{errors.confirmPassword}</p>{/if}
								</div>
							</div>

							<!-- หน่วยงานและสาขาวิชา -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="space-y-1">
									<Label for="faculty" class="flex items-center gap-2">
										<IconUser class="h-4 w-4" />
										หน่วยงาน
									</Label>
									<Select.Root type="single" bind:value={selectedFaculty} disabled={submitting || loadingOrgs}>
										<Select.Trigger id="faculty" class="w-full">
											{#if loadingOrgs}
												กำลังโหลด...
											{:else}
												{facultyOptions.find((o) => o.value === selectedFaculty)?.label ?? 'เลือกหน่วยงาน'}
											{/if}
										</Select.Trigger>
										<Select.Content>
											{#each facultyOptions as option}
												<Select.Item value={option.value}>{option.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
									{#if errors.organization_id}<p class="text-sm text-destructive">{errors.organization_id}</p>{/if}
								</div>
								<div class="space-y-1">
									<Label for="department" class="flex items-center gap-2">
										<IconUser class="h-4 w-4" />
										สาขาวิชา
									</Label>
									<Select.Root
										type="single"
										bind:value={selectedDepartment}
										disabled={submitting || loadingDepartments || !selectedFaculty}
									>
										<Select.Trigger id="department" class="w-full">
											{#if loadingDepartments}
												กำลังโหลด...
											{:else if !selectedFaculty}
												เลือกหน่วยงานก่อน
											{:else if departmentOptions.length === 0}
												ไม่มีสาขาวิชา
											{:else}
												{departmentOptions.find((o) => o.value === selectedDepartment)?.label ?? 'เลือกสาขาวิชา'}
											{/if}
										</Select.Trigger>
										<Select.Content>
											{#each departmentOptions as option}
												<Select.Item value={option.value}>{option.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
							</div>

							<div
								class="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							>
								<p class="mb-1 font-medium">หมายเหตุ:</p>
								<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
									<ul class="list-inside list-disc space-y-1">
										<li>รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</li>
										<li>ต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข</li>
									</ul>
									<ul class="list-inside list-disc space-y-1">
										<li>เลือกหน่วยงานก่อนเพื่อดูรายการสาขาวิชา</li>
										<li>หน่วยงานเป็นข้อมูลที่จำเป็น</li>
									</ul>
								</div>
							</div>

							<Button type="submit" class="w-full" disabled={submitting}>
								{#if submitting}
									<IconLoader class="mr-2 h-4 w-4 animate-spin" />
									กำลังสมัครสมาชิก...
								{:else}
									สมัครสมาชิก
								{/if}
							</Button>
						</form>

						<div class="text-center">
							<p class="text-sm text-gray-600 dark:text-gray-400">
								มีบัญชีแล้ว?
								<a href="/login" class="font-medium text-primary hover:text-primary/90">
									เข้าสู่ระบบ
								</a>
							</p>
						</div>
					</CardContent>
				</Card>

				<div class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
					<p>© 2025 Trackivity. All rights reserved.</p>
				</div>
			</div>
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

	@media (max-width: 768px) {
		:global(html, body) {
			overflow-x: hidden;
			overflow-y: auto;
			height: 100%;
		}
		.register-container {
			max-height: 100vh;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}
		.mobile-spacing {
			padding-top: 2rem;
			padding-bottom: 2rem;
		}
		:global(input, select, textarea) {
			font-size: 16px;
		}
	}
</style>
