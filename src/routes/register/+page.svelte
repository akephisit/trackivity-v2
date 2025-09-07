<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { registerSchema } from '$lib/schemas/auth';
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
	import * as Form from '$lib/components/ui/form';
	import * as Select from '$lib/components/ui/select';
	import {
		IconLoader,
		IconEye,
		IconEyeOff,
		IconUser,
		IconMail,
		IconLock,
		IconAlertTriangle,
		IconWifi,
		IconWifiOff
	} from '@tabler/icons-svelte/icons';
	import { toast } from 'svelte-sonner';
	import type { Department } from '$lib/types/admin';
	import { BasicPrefixOptions } from '$lib/schemas/auth';
	import MetaTags from '$lib/components/seo/MetaTags.svelte';

	let { data } = $props();

	const form = superForm(data.form, {
		validators: zodClient(registerSchema),
		onResult: ({ result }) => {
			if (result.type === 'failure') {
				toast.error('การสมัครสมาชิกไม่สำเร็จ');
			} else if (result.type === 'redirect') {
				toast.success('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
			}
		}
	});

	const { form: formData, enhance, errors, submitting } = form;

	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Organization and Department selection state variables
	let selectedFaculty = $state('');
	let selectedDepartment = $state('');
	let departments = $state<Department[]>([]);
	let loadingDepartments = $state(false);

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function toggleConfirmPasswordVisibility() {
		showConfirmPassword = !showConfirmPassword;
	}

	// Organization options for registration
	let facultyOptions = $derived(
		(data.organizations || []).map((org: any) => ({
			value: org.id,
			label: org.name
		}))
	);

	// Department options based on selected faculty
	let departmentOptions = $derived(
		departments.map((dept) => ({
			value: dept.id,
			label: dept.name
		}))
	);

	// Handle faculty selection
	$effect(() => {
		if (selectedFaculty && selectedFaculty.trim() !== '') {
			$formData.organization_id = selectedFaculty;
			// Reset department when faculty changes
			selectedDepartment = '';
			$formData.department_id = '';
			// Load departments for selected faculty
			loadDepartments(selectedFaculty);
		} else {
			$formData.organization_id = '';
			selectedDepartment = '';
			$formData.department_id = '';
			departments = [];
		}
	});

	// Handle department selection
	$effect(() => {
		if (selectedDepartment && selectedDepartment.trim() !== '') {
			$formData.department_id = selectedDepartment;
		} else {
			$formData.department_id = '';
		}
	});

	// Load departments based on organization selection
	async function loadDepartments(facultyId: string) {
		if (!facultyId) {
			departments = [];
			return;
		}

		loadingDepartments = true;
		try {
			const response = await fetch(`/api/organizations/${facultyId}/departments/public`);
			if (response.ok) {
				const result = await response.json();
				departments = result.data || [];
			} else {
				console.warn('Failed to load departments:', response.status);
				departments = [];
			}
		} catch (error) {
			console.error('Error loading departments:', error);
			departments = [];
		} finally {
			loadingDepartments = false;
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
						<form method="POST" use:enhance class="space-y-4">
							{#if $errors._errors}
								<Alert variant="destructive">
									<IconAlertTriangle class="h-4 w-4" />
									<AlertDescription>
										<div class="space-y-2">
											<p class="font-medium">เกิดข้อผิดพลาดในการสมัครสมาชิก</p>
											<p class="text-sm">{$errors._errors[0]}</p>
										</div>
									</AlertDescription>
								</Alert>
							{/if}

							<!-- คำนำหน้า -->
							<Form.Field {form} name="prefix">
								<Form.Control>
									{#snippet children({ props })}
										<Label for={props.id} class="flex items-center gap-2">
											<IconUser class="h-4 w-4" />
											คำนำหน้า
										</Label>
										<Select.Root type="single" bind:value={$formData.prefix} disabled={$submitting}>
											<Select.Trigger class="w-full">
												{BasicPrefixOptions.find((opt) => opt.value === $formData.prefix)?.label ??
													'เลือกคำนำหน้า'}
											</Select.Trigger>
											<Select.Content>
												{#each BasicPrefixOptions as option}
													<Select.Item value={option.value}>
														{option.label}
													</Select.Item>
												{/each}
											</Select.Content>
										</Select.Root>
										<input type="hidden" {...props} bind:value={$formData.prefix} />
									{/snippet}
								</Form.Control>
								<Form.FieldErrors />
							</Form.Field>

							<!-- ชื่อจริงและนามสกุล - 2 คอลัมน์ -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<Form.Field {form} name="first_name">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconUser class="h-4 w-4" />
												ชื่อจริง
											</Label>
											<Input
												{...props}
												type="text"
												bind:value={$formData.first_name}
												placeholder="ชื่อจริงของคุณ"
												disabled={$submitting}
												class="w-full"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>

								<Form.Field {form} name="last_name">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconUser class="h-4 w-4" />
												นามสกุล
											</Label>
											<Input
												{...props}
												type="text"
												bind:value={$formData.last_name}
												placeholder="นามสกุลของคุณ"
												disabled={$submitting}
												class="w-full"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- รหัสนักศึกษาและอีเมล - 2 คอลัมน์ -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<!-- รหัสนักศึกษา -->
								<Form.Field {form} name="student_id">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconUser class="h-4 w-4" />
												รหัสนักศึกษา
											</Label>
											<Input
												{...props}
												type="text"
												bind:value={$formData.student_id}
												placeholder="64123456789"
												disabled={$submitting}
												class="w-full"
												maxlength={12}
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>

								<!-- อีเมล -->
								<Form.Field {form} name="email">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconMail class="h-4 w-4" />
												อีเมล
											</Label>
											<Input
												{...props}
												type="email"
												bind:value={$formData.email}
												placeholder="your@email.com"
												disabled={$submitting}
												class="w-full"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- รหัสผ่านและยืนยันรหัสผ่าน - 2 คอลัมน์ -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<Form.Field {form} name="password">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconLock class="h-4 w-4" />
												รหัสผ่าน
											</Label>
											<div class="relative">
												<Input
													{...props}
													type={showPassword ? 'text' : 'password'}
													bind:value={$formData.password}
													placeholder="รหัสผ่านของคุณ"
													disabled={$submitting}
													class="w-full pr-10"
												/>
												<button
													type="button"
													onclick={togglePasswordVisibility}
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
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>

								<Form.Field {form} name="confirmPassword">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconLock class="h-4 w-4" />
												ยืนยันรหัสผ่าน
											</Label>
											<div class="relative">
												<Input
													{...props}
													type={showConfirmPassword ? 'text' : 'password'}
													bind:value={$formData.confirmPassword}
													placeholder="ยืนยันรหัสผ่านของคุณ"
													disabled={$submitting}
													class="w-full pr-10"
												/>
												<button
													type="button"
													onclick={toggleConfirmPasswordVisibility}
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
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<!-- หน่วยงานและสาขาวิชา - 2 คอลัมน์ -->
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<!-- หน่วยงาน -->
								<Form.Field {form} name="organization_id">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconUser class="h-4 w-4" />
												หน่วยงาน
											</Label>
											<Select.Root
												type="single"
												bind:value={selectedFaculty}
												disabled={$submitting}
											>
												<Select.Trigger class="w-full">
													{facultyOptions.find((opt) => opt.value.toString() === selectedFaculty)
														?.label ?? 'เลือกหน่วยงาน'}
												</Select.Trigger>
												<Select.Content>
													{#each facultyOptions as option}
														<Select.Item value={option.value.toString()} label={option.label}>
															{option.label}
														</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
											<input type="hidden" {...props} bind:value={$formData.organization_id} />
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>

								<!-- สาขาวิชา -->
								<Form.Field {form} name="department_id">
									<Form.Control>
										{#snippet children({ props })}
											<Label for={props.id} class="flex items-center gap-2">
												<IconUser class="h-4 w-4" />
												สาขาวิชา
											</Label>
											<Select.Root
												type="single"
												bind:value={selectedDepartment}
												disabled={$submitting || loadingDepartments || !selectedFaculty}
											>
												<Select.Trigger class="w-full">
													{#if loadingDepartments}
														กำลังโหลด...
													{:else if !selectedFaculty}
														เลือกหน่วยงานก่อน
													{:else if departmentOptions.length === 0}
														ไม่มีสาขาวิชา
													{:else}
														{departmentOptions.find(
															(opt) => opt.value.toString() === selectedDepartment
														)?.label ?? 'เลือกสาขาวิชา'}
													{/if}
												</Select.Trigger>
												<Select.Content>
													{#each departmentOptions as option}
														<Select.Item value={option.value.toString()} label={option.label}>
															{option.label}
														</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
											<input type="hidden" {...props} bind:value={$formData.department_id} />
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</div>

							<div
								class="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							>
								<p class="mb-1 font-medium">หมายเหตุ:</p>
								<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
									<div>
										<ul class="list-inside list-disc space-y-1">
											<li>รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</li>
											<li>ต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข</li>
										</ul>
									</div>
									<div>
										<ul class="list-inside list-disc space-y-1">
											<li>เลือกหน่วยงานก่อนเพื่อดูรายการสาขาวิชา</li>
											<li>หน่วยงานและสาขาวิชาเป็นข้อมูลที่จำเป็น</li>
											<li>สามารถแก้ไขข้อมูลได้ภายหลัง</li>
										</ul>
									</div>
								</div>
							</div>

							<Button type="submit" class="w-full" disabled={$submitting}>
								{#if $submitting}
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
					<p>© 2025 Admin Management System. All rights reserved.</p>
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

	/* Ensure proper scrolling on mobile */
	@media (max-width: 768px) {
		:global(html, body) {
			overflow-x: hidden;
			overflow-y: auto;
			height: 100%;
		}

		/* Optimize form scrolling on mobile */
		.register-container {
			max-height: 100vh;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}

		/* Better spacing for mobile */
		.mobile-spacing {
			padding-top: 2rem;
			padding-bottom: 2rem;
		}

		/* Prevent zoom on form inputs */
		:global(input, select, textarea) {
			font-size: 16px;
		}
	}
</style>
