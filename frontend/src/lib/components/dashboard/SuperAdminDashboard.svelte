<script lang="ts">
	import { CircleAlert, ChartLine, CalendarDays, ChevronRight, Crown, Database, Plus, School, Shield, UserPlus, Users } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { organizationsApi } from '$lib/api';
	import type { Organization } from '$lib/types';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Progress } from '$lib/components/ui/progress';
	let faculties = $state<Organization[]>([]);
	let loadingFaculties = $state(true);
	let error = $state<string | null>(null);

	// Derived totals from faculty list (backend doesn't expose a dedicated analytics endpoint yet)
	const totalStudents = $derived(faculties.reduce((sum, f) => sum + (f.total_students || 0), 0));
	const totalActivities = $derived(faculties.reduce((sum, f) => sum + (f.total_activities || 0), 0));
	const totalFaculties = $derived(faculties.length);

	onMount(async () => {
		await loadFaculties();
	});

	async function loadFaculties() {
		try {
			loadingFaculties = true;
			const response = await organizationsApi.list();
			faculties = response as any;
		} catch (err) {
			console.error('Failed to load faculties:', err);
			error = 'ไม่สามารถโหลดข้อมูลหน่วยงานได้';
		} finally {
			loadingFaculties = false;
		}
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('th-TH').format(num);
	}

	function calculateFacultyUtilization(faculty: Organization): number {
		if (!faculty.total_students || faculty.total_students === 0) return 0;
		return Math.min(100, (faculty.total_students / 1000) * 100);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				<Crown class="size-6 text-yellow-600 dark:text-yellow-400" />
				ภาพรวมระบบ
			</h1>
			<p class="text-muted-foreground">แดชบอร์ดสำหรับผู้ดูแลระบบสูงสุด</p>
		</div>
		<div class="flex gap-2">
			<Button size="sm" href="/admin/system/users/create">
				<UserPlus class="mr-2 size-4" />
				เพิ่มผู้ใช้
			</Button>
			<Button size="sm" variant="outline" href="/admin/system/organizations/create">
				<Plus class="mr-2 size-4" />
				เพิ่มหน่วยงาน
			</Button>
		</div>
	</div>

	<!-- Key Metrics -->
	{#if error}
		<Alert variant="destructive">
			<CircleAlert class="size-4" />
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	{/if}

	<div class="grid gap-6 md:grid-cols-3">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">หน่วยงานทั้งหมด</CardTitle>
				<School class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loadingFaculties ? '--' : formatNumber(totalFaculties)}
				</div>
				<p class="text-xs text-muted-foreground">คณะ/สำนักงาน</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">นักศึกษาทั้งหมด</CardTitle>
				<Users class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loadingFaculties ? '--' : formatNumber(totalStudents)}
				</div>
				<p class="text-xs text-muted-foreground">รวมทุกหน่วยงาน</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">กิจกรรมทั้งหมด</CardTitle>
				<CalendarDays class="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					{loadingFaculties ? '--' : formatNumber(totalActivities)}
				</div>
				<p class="text-xs text-muted-foreground">รวมทุกหน่วยงาน</p>
			</CardContent>
		</Card>
	</div>

	<!-- Faculty Overview and Quick Actions -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Faculty Overview -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between">
					<span class="flex items-center gap-2">
						<School class="size-5" />
						ภาพรวมหน่วยงาน
					</span>
					<Button size="sm" variant="outline" href="/admin/system/organizations">
						จัดการหน่วยงาน
						<ChevronRight class="ml-1 size-4" />
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loadingFaculties}
					<div class="space-y-4">
						{#each Array(3) as _}
							<div class="space-y-2">
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-2 w-full" />
								<Skeleton class="h-3 w-1/2" />
							</div>
						{/each}
					</div>
				{:else if faculties.length === 0}
					<div class="py-6 text-center text-muted-foreground">
						<School class="mx-auto mb-2 size-8 opacity-50" />
						<p>ยังไม่มีหน่วยงานในระบบ</p>
						<Button size="sm" href="/admin/system/organizations/create" class="mt-2">
							เพิ่มหน่วยงานแรก
						</Button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each faculties.slice(0, 5) as faculty}
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<div>
										<h4 class="text-sm font-medium">{faculty.name}</h4>
										<p class="text-xs text-muted-foreground">{faculty.code}</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">
											{formatNumber(faculty.total_students || 0)} คน
										</p>
										<p class="text-xs text-muted-foreground">
											{formatNumber(faculty.total_activities || 0)} กิจกรรม
										</p>
									</div>
								</div>

								<div class="space-y-1">
									<div class="flex items-center justify-between text-xs">
										<span class="text-muted-foreground">การใช้งาน</span>
										<span>{calculateFacultyUtilization(faculty).toFixed(0)}%</span>
									</div>
									<Progress value={calculateFacultyUtilization(faculty)} class="h-2" />
								</div>
							</div>
						{/each}

						{#if faculties.length > 5}
							<div class="border-t pt-2">
								<Button
									size="sm"
									variant="outline"
									href="/admin/system/organizations"
									class="w-full"
								>
									ดูหน่วยงานทั้งหมด ({faculties.length - 5} อื่น ๆ)
								</Button>
							</div>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Quick Actions -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Shield class="size-5" />
					การดำเนินการระบบ
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<Button href="/admin/system/users" variant="outline" class="w-full justify-start">
						<Users class="mr-2 size-4" />
						จัดการผู้ใช้
					</Button>

					<Button href="/admin/system/organizations" variant="outline" class="w-full justify-start">
						<School class="mr-2 size-4" />
						จัดการหน่วยงาน
					</Button>

					<Button href="/admin/system/admins" variant="outline" class="w-full justify-start">
						<Shield class="mr-2 size-4" />
						จัดการผู้ดูแลระบบ
					</Button>

					<Button href="/admin/system/settings" variant="outline" class="w-full justify-start">
						<Database class="mr-2 size-4" />
						ตั้งค่าระบบ
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- System Status -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<ChartLine class="size-5" />
				สถานะระบบ
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 md:grid-cols-3">
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ระบบฐานข้อมูล</span>
						<Badge variant="default">ปกติ</Badge>
					</div>
					<Progress value={95} class="h-2" />
					<p class="text-xs text-muted-foreground">95% ของพื้นที่ใช้งาน</p>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ระบบการเชื่อมต่อ</span>
						<Badge variant="default">ปกติ</Badge>
					</div>
					<Progress value={98} class="h-2" />
					<p class="text-xs text-muted-foreground">98% uptime</p>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">ประสิทธิภาพระบบ</span>
						<Badge variant="default">ดี</Badge>
					</div>
					<Progress value={87} class="h-2" />
					<p class="text-xs text-muted-foreground">เฉลี่ย 87ms response time</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
