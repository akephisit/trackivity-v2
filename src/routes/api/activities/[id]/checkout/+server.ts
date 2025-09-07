import { json, type RequestHandler } from '@sveltejs/kit';
import { db, activities, users, participations } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

function decodeQR(
	qr_data: string
): { uid?: string; sid?: string; ts?: number; exp?: number } | null {
	try {
		const raw = Buffer.from(qr_data, 'base64').toString('utf-8');
		const obj = JSON.parse(raw);
		if (obj && typeof obj === 'object') return obj;
	} catch (_) {}
	try {
		const obj = JSON.parse(qr_data);
		return obj;
	} catch (_) {
		return null;
	}
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		// Require admin or staff session (locals.user is set when authenticated)
		if (!locals.user || !locals.user.is_admin) {
			return json(
				{
					success: false,
					error: {
						code: 'AUTH_ERROR',
						message: 'ต้องการสิทธิ์ผู้ดูแลระบบ',
						category: 'error'
					}
				},
				{ status: 401 }
			);
		}

		const activityId = params.id;
		const { qr_data } = await request.json().catch(() => ({ qr_data: '' }));

		if (!activityId || !qr_data) {
			return json(
				{
					success: false,
					error: {
						code: 'VALIDATION_ERROR',
						message: 'ข้อมูลไม่ครบถ้วน',
						category: 'error'
					}
				},
				{ status: 400 }
			);
		}

		// Fetch comprehensive activity information
		const actRows = await db
			.select({
				id: activities.id,
				status: activities.status,
				title: activities.title,
				eligibleOrganizations: activities.eligibleOrganizations,
				organizerId: activities.organizerId
			})
			.from(activities)
			.where(eq(activities.id, activityId))
			.limit(1);

		if (actRows.length === 0) {
			return json(
				{
					success: false,
					error: {
						code: 'ACTIVITY_NOT_FOUND',
						message: 'ไม่พบกิจกรรมที่ระบุ',
						category: 'error'
					}
				},
				{ status: 404 }
			);
		}

		const activity = actRows[0];

		// Check admin permission for this specific activity
		const adminOrganizationId = (locals.user as any)?.organization_id;
		const adminLevel = (locals.user as any)?.admin_level;

		// SuperAdmin can scan all activities
		if (adminLevel !== 'SuperAdmin') {
			// OrganizationAdmin can only scan activities where they are:
			// 1. The organizer (organizerId matches their organization)
			// 2. In the eligibleOrganizations array
			if (adminLevel === 'OrganizationAdmin' && adminOrganizationId) {
				const canScan =
					activity.organizerId === adminOrganizationId ||
					(activity.eligibleOrganizations &&
						Array.isArray(activity.eligibleOrganizations) &&
						activity.eligibleOrganizations.includes(adminOrganizationId));

				if (!canScan) {
					return json(
						{
							success: false,
							error: {
								code: 'PERMISSION_DENIED',
								message: 'คุณไม่มีสิทธิ์ในการสแกน QR Code สำหรับกิจกรรมนี้',
								category: 'error'
							}
						},
						{ status: 403 }
					);
				}
			} else {
				// RegularAdmin or other levels - no scanning permission
				return json(
					{
						success: false,
						error: {
							code: 'INSUFFICIENT_PRIVILEGES',
							message: 'ระดับสิทธิ์ของคุณไม่เพียงพอสำหรับการสแกน QR Code',
							category: 'error'
						}
					},
					{ status: 403 }
				);
			}
		}

		// Allow checkout when ongoing or completed
		if (!(activity.status === 'ongoing' || activity.status === 'completed')) {
			return json(
				{
					success: false,
					error: {
						code: 'INVALID_CHECKOUT_STATUS',
						message: 'ไม่สามารถเช็คเอาท์ได้ในขณะนี้',
						category: 'restricted',
						details: { activityStatus: activity.status }
					}
				},
				{ status: 400 }
			);
		}

		const payload = decodeQR(qr_data);
		if (!payload?.uid) {
			return json(
				{
					success: false,
					error: {
						code: 'QR_INVALID',
						message: 'QR Code ไม่ถูกต้อง หรือเสียหาย',
						category: 'error'
					}
				},
				{ status: 400 }
			);
		}

		if (payload.exp && Date.now() > payload.exp) {
			return json(
				{
					success: false,
					error: {
						code: 'QR_EXPIRED',
						message: 'QR Code หมดอายุแล้ว',
						category: 'restricted'
					}
				},
				{ status: 400 }
			);
		}

		const userRows = await db
			.select({
				id: users.id,
				studentId: users.studentId,
				firstName: users.firstName,
				lastName: users.lastName,
				status: users.status
			})
			.from(users)
			.where(eq(users.id, payload.uid))
			.limit(1);

		if (userRows.length === 0) {
			return json(
				{
					success: false,
					error: {
						code: 'STUDENT_NOT_FOUND',
						message: 'ไม่พบนักศึกษาในระบบ',
						category: 'error'
					}
				},
				{ status: 404 }
			);
		}

		const u = userRows[0];

		// Check user account status
		if (u.status !== 'active') {
			let userStatusMessage = '';
			switch (u.status) {
				case 'inactive':
					userStatusMessage = 'บัญชีนักศึกษาไม่ได้ใช้งาน';
					break;
				case 'suspended':
					userStatusMessage = 'บัญชีนักศึกษาถูกระงับ';
					break;
				default:
					userStatusMessage = 'สถานะบัญชีนักศึกษาไม่ถูกต้อง';
			}

			return json(
				{
					success: false,
					error: {
						code: 'STUDENT_ACCOUNT_INACTIVE',
						message: userStatusMessage,
						category: 'restricted',
						details: { userStatus: u.status }
					}
				},
				{ status: 400 }
			);
		}

		// Check existing participation - FLEXIBLE FLOW: Allow check-out without check-in
		const existing = await db
			.select({
				id: participations.id,
				status: participations.status,
				checkedInAt: participations.checkedInAt,
				checkedOutAt: participations.checkedOutAt,
				registeredAt: participations.registeredAt
			})
			.from(participations)
			.where(and(eq(participations.activityId, activityId), eq(participations.userId, u.id)))
			.limit(1);

		const now = new Date();

		// Handle case where no participation record exists (direct check-out)
		if (existing.length === 0) {
			// Create new participation record with direct check-out
			await db.insert(participations).values({
				activityId,
				userId: u.id,
				status: 'checked_out',
				checkedOutAt: now,
				registeredAt: now
				// No checkedInAt - this represents direct check-out
			});

			return json({
				success: true,
				message: 'เช็คเอาท์สำเร็จ (ไม่ผ่านการเช็คอิน)',
				category: 'success',
				data: {
					user_name: `${u.firstName} ${u.lastName}`.trim(),
					student_id: u.studentId,
					participation_status: 'checked_out',
					checked_out_at: now.toISOString(),
					activity_title: activity.title,
					is_direct_checkout: true // Flag for activities that don't require check-in
				}
			});
		}

		const participation = existing[0];

		// Allow duplicate check-out with minimal warning
		if (participation.status === 'checked_out' && participation.checkedOutAt) {
			return json({
				success: true,
				message: 'เช็คเอาท์สำเร็จ (ได้เช็คเอาท์ไว้แล้ว)',
				category: 'success',
				data: {
					user_name: `${u.firstName} ${u.lastName}`.trim(),
					student_id: u.studentId,
					participation_status: 'checked_out',
					checked_out_at: participation.checkedOutAt, // Use existing timestamp
					activity_title: activity.title,
					previous_check_in: participation.checkedInAt,
					is_duplicate: true // Flag for minimal UI feedback
				}
			});
		}

		// ONLY RESTRICTION: Prevent any action after completion
		if (participation.status === 'completed') {
			return json(
				{
					success: false,
					error: {
						code: 'ALREADY_COMPLETED',
						message: 'ไม่สามารถเช็คเอาท์หลังจากการเข้าร่วมสิ้นสุดแล้ว',
						category: 'flow_violation',
						details: {
							completionStatus: participation.status,
							flowMessage: 'การเข้าร่วมกิจกรรมได้สิ้นสุดแล้ว'
						}
					}
				},
				{ status: 400 }
			);
		}

		// Update existing participation to checked_out
		await db
			.update(participations)
			.set({ status: 'checked_out', checkedOutAt: now })
			.where(eq(participations.id, participation.id));

		return json({
			success: true,
			message: 'เช็คเอาท์สำเร็จ',
			category: 'success',
			data: {
				user_name: `${u.firstName} ${u.lastName}`.trim(),
				student_id: u.studentId,
				participation_status: 'checked_out',
				checked_out_at: now.toISOString(),
				activity_title: activity.title,
				previous_check_in: participation.checkedInAt
			}
		});
	} catch (e) {
		console.error('[CheckOut] error:', e);
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'เกิดข้อผิดพลาดภายในระบบ ไม่สามารถเช็คเอาท์ได้',
					category: 'error'
				}
			},
			{ status: 500 }
		);
	}
};
