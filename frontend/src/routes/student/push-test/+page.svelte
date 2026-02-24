<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { notificationsApi } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { IconBellRinging, IconSend } from '@tabler/icons-svelte';

	let loading = $state(false);

	async function sendTestPush() {
		loading = true;
		try {
			await notificationsApi.testPush();
			toast.success('ส่งคำสั่งแจ้งเตือนทดสอบแล้ว');
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto mt-8 max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">ทดสอบระบบแจ้งเตือน (Web Push)</h1>
		<p class="mt-2 text-muted-foreground">
			หน้าต่างนี้มีความมุ่งหมายเพื่อใช้ทดสอบการทำงานของ Web Push Notification
			ว่าอุปกรณ์ได้รับข้อความและเด้งขึ้นมาจริงหรือไม่
		</p>
	</div>

	<div class="space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow">
		<div class="flex items-center gap-4 border-b pb-4">
			<div class="rounded-full bg-primary/10 p-3 text-primary">
				<IconBellRinging size={24} />
			</div>
			<div>
				<h2 class="text-lg font-semibold">เริ่มการทดสอบ</h2>
				<p class="text-sm text-muted-foreground">
					ปุ่มด้านล่างจะยิงคำสั่งไปยังเซิร์ฟเวอร์เพื่อให้ส่งแจ้งเตือนกลับมายังเครื่องคุณ
				</p>
			</div>
		</div>

		<div class="flex flex-col gap-4 pt-4">
			<p class="rounded bg-muted/50 p-3 text-sm">
				<strong>💡 ข้อควรระวัง:</strong> <br />
				1. คุณต้องกด 'อนุญาต (Allow)' แจ้งเตือนในเบราว์เซอร์ไปแล้ว <br />
				2. ในอุปกรณ์บางชนิด เช่น iOS (iPhone) คุณต้อง "เพิ่มลงในหน้าจอโฮม (Add to Home Screen)" ก่อนถึงจะรับแจ้งเตือนแบบ
				Push ได้
			</p>

			<Button onclick={sendTestPush} disabled={loading} class="w-full sm:w-fit" size="lg">
				{#if loading}
					กำลังส่ง...
				{:else}
					<IconSend class="mr-2" size={18} /> ทดสอบยิง Push Notification
				{/if}
			</Button>
		</div>
	</div>
</div>
