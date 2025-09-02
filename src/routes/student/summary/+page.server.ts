import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth-utils';
import { db, participations, activities, organizations, organizationActivityRequirements, users, departments } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  event.depends('student:summary');

  try {
    // Fetch all participation data (same query as history page)
    const rowsAll = await db
      .select({
        id: participations.id,
        activity_id: participations.activityId,
        user_id: participations.userId,
        registered_at: participations.registeredAt,
        checked_in_at: participations.checkedInAt,
        checked_out_at: participations.checkedOutAt,
        status: participations.status,
        notes: participations.notes,
        // activity fields
        a_id: activities.id,
        a_title: activities.title,
        a_description: activities.description,
        a_location: activities.location,
        a_type: activities.activityType,
        a_start_date: activities.startDate,
        a_end_date: activities.endDate,
        a_start_time: activities.startTimeOnly,
        a_end_time: activities.endTimeOnly,
        a_hours: activities.hours,
        a_status: activities.status,
        a_organizer_id: activities.organizerId,
        a_activity_level: activities.activityLevel,
        // organizer organization
        org_name: organizations.name
      })
      .from(participations)
      .leftJoin(activities, eq(participations.activityId, activities.id))
      .leftJoin(organizations, eq(activities.organizerId, organizations.id))
      .where(eq(participations.userId, user.user_id));

    // Transform data to match expected format
    const participationHistory = rowsAll.map((r) => {
      // Use the most relevant timestamp for participated_at
      const participated_at = (r.checked_out_at || r.checked_in_at || r.registered_at || new Date()).toISOString?.() || String(r.checked_out_at || r.checked_in_at || r.registered_at || new Date());
      
      return {
        id: r.id,
        activity_id: r.activity_id,
        user_id: r.user_id,
        participated_at,
        registered_at: r.registered_at?.toISOString?.() || String(r.registered_at || ''),
        checked_in_at: r.checked_in_at?.toISOString?.() || (r.checked_in_at ? String(r.checked_in_at) : null),
        checked_out_at: r.checked_out_at?.toISOString?.() || (r.checked_out_at ? String(r.checked_out_at) : null),
        status: r.status,
        notes: r.notes,
        activity: {
          id: r.a_id,
          name: r.a_title,
          title: r.a_title,
          description: r.a_description || '',
          activity_type: r.a_type || 'Other',
          location: r.a_location || '',
          start_date: r.a_start_date as any,
          end_date: r.a_end_date as any,
          start_time: r.a_start_time,
          end_time: r.a_end_time,
          hours: r.a_hours,
          status: r.a_status,
          organizer_name: r.org_name,
          activity_level: r.a_activity_level
        }
      };
    });

    // Get current user information for the report header
    const userInfo = {
      student_id: user.student_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email
    };

    // Fetch user's organization through department
    let activityRequirements = null;
    try {
      const userRecord = await db
        .select({
          departmentId: users.departmentId
        })
        .from(users)
        .where(eq(users.id, user.user_id))
        .limit(1);

      if (userRecord[0]?.departmentId) {
        const departmentRecord = await db
          .select({
            organizationId: departments.organizationId
          })
          .from(departments)
          .where(eq(departments.id, userRecord[0].departmentId))
          .limit(1);

        if (departmentRecord[0]?.organizationId) {
          const requirements = await db
            .select({
              requiredFacultyHours: organizationActivityRequirements.requiredFacultyHours,
              requiredUniversityHours: organizationActivityRequirements.requiredUniversityHours
            })
            .from(organizationActivityRequirements)
            .where(eq(organizationActivityRequirements.organizationId, departmentRecord[0].organizationId))
            .limit(1);

          if (requirements[0]) {
            activityRequirements = requirements[0];
          }
        }
      }
    } catch (e) {
      console.error('[Student Summary] Failed to load activity requirements:', e);
    }

    return { 
      participationHistory,
      userInfo,
      activityRequirements
    };
  } catch (e) {
    console.error('[Student Summary] load error:', e);
    return { 
      participationHistory: [],
      userInfo: null,
      activityRequirements: null
    };
  }
};