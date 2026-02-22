/**
 * Activity Tracker for Session Management
 * จับการใช้งานของผู้ใช้ทุก 30 นาที → เรียก /auth/me เพื่อ verify ว่า session ยังอยู่
 * ถ้า 401 (session หมดหรือถูก revoke) → logout อัตโนมัติ
 * ไม่มี DB write ต่อ request — ใช้ JWT Long Expiry (7 วัน) ทำงานร่วมกัน
 */

import { browser } from '$app/environment';
import { auth } from '$lib/api';
import { authStore } from '$lib/stores/auth.svelte';

class ActivityTracker {
	private lastActivity: number = Date.now();
	private checkTimer: ReturnType<typeof setTimeout> | null = null;
	private isTracking: boolean = false;

	// ตรวจสอบทุก 30 นาที
	private readonly CHECK_INTERVAL = 30 * 60 * 1000;
	// ถ้า user ไม่มีการใช้งานเกิน 60 นาที → หยุดตรวจ (ค่อยเริ่มใหม่เมื่อ active อีกครั้ง)
	private readonly INACTIVE_THRESHOLD = 60 * 60 * 1000;

	constructor() {
		if (browser) {
			this.bindEvents();
		}
	}

	private bindEvents(): void {
		const update = () => this.onUserActivity();
		document.addEventListener('click', update, { passive: true });
		document.addEventListener('keypress', update, { passive: true });
		document.addEventListener('scroll', update, { passive: true });
		document.addEventListener('mousemove', update, { passive: true });
		window.addEventListener('focus', update, { passive: true });
		document.addEventListener('visibilitychange', () => {
			// เมื่อ Tab กลับมา focus → รีเซ็ต activity ทันที
			if (document.visibilityState === 'visible') update();
		}, { passive: true });
	}

	private onUserActivity(): void {
		this.lastActivity = Date.now();
		// ถ้ายังไม่มี timer วิ่งอยู่ → เริ่มใหม่
		if (!this.isTracking) {
			this.startTracking();
		}
	}

	public startTracking(): void {
		if (this.isTracking) return;
		this.isTracking = true;
		this.scheduleCheck();
	}

	public stopTracking(): void {
		this.isTracking = false;
		if (this.checkTimer) {
			clearTimeout(this.checkTimer);
			this.checkTimer = null;
		}
	}

	private scheduleCheck(): void {
		if (this.checkTimer) clearTimeout(this.checkTimer);
		this.checkTimer = setTimeout(() => this.runCheck(), this.CHECK_INTERVAL);
	}

	private async runCheck(): Promise<void> {
		if (!this.isTracking) return;

		const idle = Date.now() - this.lastActivity;

		// User ไม่ active เกิน threshold → หยุดตรวจ รอให้ user กลับมา
		if (idle > this.INACTIVE_THRESHOLD) {
			console.log('[ActivityTracker] User idle, pausing checks');
			this.stopTracking();
			return;
		}

		try {
			// แค่ verify ว่า JWT ยังใช้ได้ — ไม่มี DB write
			await auth.me();
		} catch (err: any) {
			const status = err?.status ?? err?.response?.status;
			if (status === 401 || status === 403) {
				// Session หมดหรือถูก admin revoke → logout อัตโนมัติ
				console.warn('[ActivityTracker] Session invalid, logging out');
				authStore.logout();
				return;
			}
			// Network error ชั่วคราว → ไม่ logout แค่ skip รอรอบต่อไป
			console.warn('[ActivityTracker] Check failed (network?), will retry:', err?.message);
		}

		this.scheduleCheck();
	}

	public isUserActive(): boolean {
		return Date.now() - this.lastActivity <= this.INACTIVE_THRESHOLD;
	}

	public getLastActivity(): number {
		return this.lastActivity;
	}
}

// Singleton
export const activityTracker = new ActivityTracker();
