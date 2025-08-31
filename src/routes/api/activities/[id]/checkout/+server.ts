import { json, type RequestHandler } from '@sveltejs/kit';
import { db, activities, users, participations } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

function decodeQR(qr_data: string): { uid?: string; sid?: string; ts?: number; exp?: number } | null {
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
    if (!locals.user) {
      return json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication required' } }, { status: 401 });
    }

    const activityId = params.id;
    const { qr_data } = await request.json().catch(() => ({ qr_data: '' }));

    if (!activityId || !qr_data) {
      return json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing activity or QR data' } }, { status: 400 });
    }

    const actRows = await db.select({ id: activities.id, status: activities.status }).from(activities).where(eq(activities.id, activityId)).limit(1);
    if (actRows.length === 0) {
      return json({ success: false, error: { code: 'NOT_FOUND', message: 'Activity not found' } }, { status: 404 });
    }

    // Allow checkout when ongoing or completed
    if (!(actRows[0].status === 'ongoing' || actRows[0].status === 'completed')) {
      return json({ success: false, error: { code: 'INVALID_STATUS', message: 'สถานะกิจกรรมไม่รองรับการเช็คเอาท์' } }, { status: 400 });
    }

    const payload = decodeQR(qr_data);
    if (!payload?.uid) {
      return json({ success: false, error: { code: 'QR_INVALID', message: 'QR ไม่ถูกต้อง' } }, { status: 400 });
    }
    if (payload.exp && Date.now() > payload.exp) {
      return json({ success: false, error: { code: 'QR_EXPIRED', message: 'QR Code หมดอายุ' } }, { status: 400 });
    }

    const userRows = await db
      .select({ id: users.id, studentId: users.studentId, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, payload.uid))
      .limit(1);
    if (userRows.length === 0) {
      return json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบนักศึกษาในระบบ' } }, { status: 404 });
    }
    const u = userRows[0];

    // Require existing participation
    const existing = await db
      .select({ id: participations.id, status: participations.status })
      .from(participations)
      .where(and(eq(participations.activityId, activityId), eq(participations.userId, u.id)))
      .limit(1);

    if (existing.length === 0) {
      return json({ success: false, error: { code: 'NOT_REGISTERED', message: 'ยังไม่ได้เช็คอิน/ลงทะเบียน' } }, { status: 400 });
    }

    const now = new Date();
    await db
      .update(participations)
      .set({ status: 'checked_out', checkedOutAt: now })
      .where(eq(participations.id, existing[0].id));

    return json({
      success: true,
      message: 'เช็คเอาท์สำเร็จ',
      data: {
        user_name: `${u.firstName} ${u.lastName}`.trim(),
        student_id: u.studentId,
        participation_status: 'checked_out',
        checked_out_at: now.toISOString()
      }
    });
  } catch (e) {
    console.error('[CheckOut] error:', e);
    return json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'ไม่สามารถเช็คเอาท์ได้' } }, { status: 500 });
  }
};
