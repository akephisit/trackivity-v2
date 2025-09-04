import { json, type RequestHandler } from '@sveltejs/kit';
import { db, activities, users, participations, organizations, departments } from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';

function decodeQR(qr_data: string): { uid?: string; sid?: string; ts?: number; exp?: number } | null {
  try {
    const raw = Buffer.from(qr_data, 'base64').toString('utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
  } catch (_) {
    // not base64 json; ignore
  }
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
      return json({ 
        success: false, 
        error: { 
          code: 'AUTH_ERROR', 
          message: 'ต้องการสิทธิ์ผู้ดูแลระบบ', 
          category: 'error' 
        } 
      }, { status: 401 });
    }

    const activityId = params.id;
    const { qr_data } = await request.json().catch(() => ({ qr_data: '' }));

    if (!activityId || !qr_data) {
      return json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'ข้อมูลไม่ครบถ้วน', 
          category: 'error' 
        } 
      }, { status: 400 });
    }

    // Fetch comprehensive activity information
    const actRows = await db
      .select({ 
        id: activities.id, 
        status: activities.status,
        title: activities.title,
        maxParticipants: activities.maxParticipants,
        startDate: activities.startDate,
        endDate: activities.endDate,
        startTimeOnly: activities.startTimeOnly,
        endTimeOnly: activities.endTimeOnly,
        activityLevel: activities.activityLevel,
        eligibleOrganizations: activities.eligibleOrganizations,
        organizerId: activities.organizerId
      })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);

    if (actRows.length === 0) {
      return json({ 
        success: false, 
        error: { 
          code: 'ACTIVITY_NOT_FOUND', 
          message: 'ไม่พบกิจกรรมที่ระบุ', 
          category: 'error' 
        } 
      }, { status: 404 });
    }

    const activity = actRows[0];

    // Check admin permission for this specific activity
    const adminOrganizationId = (locals.user as any)?.organization_id;
    const adminLevel = (locals.user as any)?.admin_level;
    
    // SuperAdmin can scan all activities
    if (adminLevel !== 'SuperAdmin') {
      // OrganizationAdmin can only scan activities where they are:
      // 1. The organizer (organizerId matches their organization)
      // 2. In the legacy organizationId field
      // 3. In the eligibleOrganizations array
      if (adminLevel === 'OrganizationAdmin' && adminOrganizationId) {
        const canScan = 
          activity.organizerId === adminOrganizationId ||
          (activity.eligibleOrganizations && 
           Array.isArray(activity.eligibleOrganizations) && 
           activity.eligibleOrganizations.includes(adminOrganizationId));
           
        if (!canScan) {
          return json({ 
            success: false, 
            error: { 
              code: 'PERMISSION_DENIED', 
              message: 'คุณไม่มีสิทธิ์ในการสแกน QR Code สำหรับกิจกรรมนี้', 
              category: 'error' 
            } 
          }, { status: 403 });
        }
      } else {
        // RegularAdmin or other levels - no scanning permission
        return json({ 
          success: false, 
          error: { 
            code: 'INSUFFICIENT_PRIVILEGES', 
            message: 'ระดับสิทธิ์ของคุณไม่เพียงพอสำหรับการสแกน QR Code', 
            category: 'error' 
          } 
        }, { status: 403 });
      }
    }

    // Check activity status
    if (activity.status !== 'ongoing') {
      let statusMessage = '';
      switch (activity.status) {
        case 'draft':
          statusMessage = 'กิจกรรมยังไม่ได้เผยแพร่';
          break;
        case 'published':
          statusMessage = 'กิจกรรมยังไม่เริ่ม';
          break;
        case 'completed':
          statusMessage = 'กิจกรรมสิ้นสุดแล้ว';
          break;
        case 'cancelled':
          statusMessage = 'กิจกรรมถูกยกเลิก';
          break;
        default:
          statusMessage = 'สถานะกิจกรรมไม่รองรับการเช็คอิน';
      }
      
      return json({ 
        success: false, 
        error: { 
          code: 'ACTIVITY_NOT_ONGOING', 
          message: statusMessage, 
          category: 'restricted',
          details: { activityStatus: activity.status }
        } 
      }, { status: 400 });
    }

    // Check if activity time is valid (basic time validation)
    const currentTime = new Date();
    const today = currentTime.toISOString().split('T')[0];
    
    if (activity.endDate && activity.endDate < today) {
      return json({ 
        success: false, 
        error: { 
          code: 'ACTIVITY_EXPIRED', 
          message: 'กิจกรรมหมดเวลาแล้ว', 
          category: 'restricted' 
        } 
      }, { status: 400 });
    }
    
    if (activity.startDate && activity.startDate > today) {
      return json({ 
        success: false, 
        error: { 
          code: 'ACTIVITY_NOT_STARTED', 
          message: 'กิจกรรมยังไม่เริ่ม', 
          category: 'restricted' 
        } 
      }, { status: 400 });
    }

    const payload = decodeQR(qr_data);
    if (!payload?.uid) {
      return json({ 
        success: false, 
        error: { 
          code: 'QR_INVALID', 
          message: 'QR Code ไม่ถูกต้อง หรือเสียหาย', 
          category: 'error' 
        } 
      }, { status: 400 });
    }

    if (payload.exp && Date.now() > payload.exp) {
      return json({ 
        success: false, 
        error: { 
          code: 'QR_EXPIRED', 
          message: 'QR Code หมดอายุแล้ว', 
          category: 'restricted' 
        } 
      }, { status: 400 });
    }

    // Find user with comprehensive information
    const userRows = await db
      .select({ 
        id: users.id, 
        studentId: users.studentId, 
        firstName: users.firstName, 
        lastName: users.lastName,
        status: users.status,
        departmentId: users.departmentId
      })
      .from(users)
      .where(eq(users.id, payload.uid))
      .limit(1);

    if (userRows.length === 0) {
      return json({ 
        success: false, 
        error: { 
          code: 'STUDENT_NOT_FOUND', 
          message: 'ไม่พบนักศึกษาในระบบ', 
          category: 'error' 
        } 
      }, { status: 404 });
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
      
      return json({ 
        success: false, 
        error: { 
          code: 'STUDENT_ACCOUNT_INACTIVE', 
          message: userStatusMessage, 
          category: 'restricted',
          details: { userStatus: u.status }
        } 
      }, { status: 400 });
    }

    // Check faculty/department restrictions for faculty-level activities
    if (activity.activityLevel === 'faculty' && activity.eligibleOrganizations && Array.isArray(activity.eligibleOrganizations) && activity.eligibleOrganizations.length > 0) {
      if (!u.departmentId) {
        return json({ 
          success: false, 
          error: { 
            code: 'NO_DEPARTMENT', 
            message: 'นักศึกษาไม่ได้สังกัดภาควิชาใด', 
            category: 'restricted' 
          } 
        }, { status: 400 });
      }

      // Get user's organization through department
      const userOrgRows = await db
        .select({ organizationId: departments.organizationId })
        .from(departments)
        .where(eq(departments.id, u.departmentId))
        .limit(1);

      if (userOrgRows.length === 0) {
        return json({ 
          success: false, 
          error: { 
            code: 'DEPARTMENT_NOT_FOUND', 
            message: 'ไม่พบข้อมูลภาควิชา', 
            category: 'error' 
          } 
        }, { status: 400 });
      }

      const userOrganizationId = userOrgRows[0].organizationId;
      
      // Check if user's organization is eligible
      if (!activity.eligibleOrganizations.includes(userOrganizationId)) {
        return json({ 
          success: false, 
          error: { 
            code: 'FACULTY_RESTRICTION', 
            message: 'คุณไม่ได้อยู่ในคณะที่สามารถเข้าร่วมกิจกรรมนี้ได้', 
            category: 'restricted',
            details: { 
              userOrganization: userOrganizationId,
              eligibleOrganizations: activity.eligibleOrganizations 
            }
          } 
        }, { status: 403 });
      }
    }

    // Check existing participation
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

    // Check if already participated/checked in - STRICT ONE-WAY FLOW
    if (existing.length > 0) {
      const participation = existing[0];
      
      if (participation.status === 'checked_in' && participation.checkedInAt) {
        return json({ 
          success: false, 
          error: { 
            code: 'ALREADY_CHECKED_IN', 
            message: 'คุณได้เช็คอินแล้ว', 
            category: 'already_done',
            details: {
              previousCheckIn: participation.checkedInAt,
              currentStatus: participation.status,
              advice: 'หากต้องการเช็คเอาท์ กรุณาเปลี่ยนเป็นโหมดเช็คเอาท์'
            }
          } 
        }, { status: 400 });
      }
      
      // STRICT ENFORCEMENT: Prevent check-in after check-out
      if (participation.status === 'checked_out' && participation.checkedOutAt) {
        return json({ 
          success: false, 
          error: { 
            code: 'ALREADY_CHECKED_OUT', 
            message: 'คุณได้เช็คเอาท์แล้ว ไม่สามารถเช็คอินอีกครั้งได้', 
            category: 'flow_violation',
            details: {
              previousCheckOut: participation.checkedOutAt,
              currentStatus: participation.status,
              flowMessage: 'การเข้าร่วมกิจกรรมได้สิ้นสุดแล้ว'
            }
          } 
        }, { status: 400 });
      }
      
      // STRICT ENFORCEMENT: Prevent any action after completion
      if (participation.status === 'completed') {
        return json({ 
          success: false, 
          error: { 
            code: 'ALREADY_COMPLETED', 
            message: 'คุณได้เข้าร่วมกิจกรรมครบถ้วนแล้ว ไม่สามารถเช็คอินอีกครั้งได้', 
            category: 'flow_violation',
            details: {
              completionStatus: participation.status,
              flowMessage: 'การเข้าร่วมกิจกรรมได้สิ้นสุดแล้ว'
            }
          } 
        }, { status: 400 });
      }
    }

    // Check maximum participants limit
    if (activity.maxParticipants && activity.maxParticipants > 0) {
      const participantCount = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(participations)
        .where(
          and(
            eq(participations.activityId, activityId),
            eq(participations.status, 'checked_in')
          )
        );

      const currentCount = participantCount[0]?.count || 0;
      
      if (currentCount >= activity.maxParticipants) {
        return json({ 
          success: false, 
          error: { 
            code: 'MAX_PARTICIPANTS_REACHED', 
            message: 'กิจกรรมมีผู้เข้าร่วมครบแล้ว', 
            category: 'restricted',
            details: {
              maxParticipants: activity.maxParticipants,
              currentParticipants: currentCount
            }
          } 
        }, { status: 400 });
      }
    }

    // Perform check-in
    if (existing.length === 0) {
      await db.insert(participations).values({ 
        activityId, 
        userId: u.id, 
        status: 'checked_in', 
        checkedInAt: now,
        registeredAt: now
      });
    } else {
      await db
        .update(participations)
        .set({ status: 'checked_in', checkedInAt: now })
        .where(eq(participations.id, existing[0].id));
    }

    return json({
      success: true,
      message: 'เช็คอินสำเร็จ',
      category: 'success',
      data: {
        user_name: `${u.firstName} ${u.lastName}`.trim(),
        student_id: u.studentId,
        participation_status: 'checked_in',
        checked_in_at: now.toISOString(),
        activity_title: activity.title,
        is_new_participation: existing.length === 0
      }
    });
  } catch (e) {
    console.error('[CheckIn] error:', e);
    return json({ 
      success: false, 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'เกิดข้อผิดพลาดภายในระบบ ไม่สามารถเช็คอินได้', 
        category: 'error' 
      } 
    }, { status: 500 });
  }
};
