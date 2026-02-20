/**
 * Central API client for communicating with Rust backend
 * All requests include credentials (cookies) automatically
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE}${path}`;

    const response = await fetch(url, {
        ...options,
        credentials: 'include', // Always send cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || response.statusText);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
        return response.json();
    }
    return {} as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginInput {
    email?: string;
    student_id?: string;
    password: string;
    remember_me?: boolean;
}

export interface RegisterInput {
    student_id: string;
    email: string;
    password: string;
    prefix: string;
    first_name: string;
    last_name: string;
    phone?: string;
    organization_id?: string;
    department_id?: string;
}

export interface AdminRole {
    id: string;
    user_id: string;
    admin_level: 'super_admin' | 'organization_admin' | 'regular_admin';
    organization_id: string | null;
    permissions: string[];
    is_enabled: boolean;
}

export interface UserResponse {
    user_id: string;
    student_id: string;
    email: string;
    prefix: string;
    first_name: string;
    last_name: string;
    admin_role: AdminRole | null;
    organization_id?: string | null;
    organization_name?: string | null;
    department_id?: string | null;
    department_name?: string | null;
    session_id: string;
    expires_at: string;
}

export interface AuthResponse {
    token: string;
    user: UserResponse;
}

export const auth = {
    login: (data: LoginInput) =>
        request<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    register: (data: RegisterInput) =>
        request<{ user_id: string; message: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    logout: () =>
        request<{ message: string }>('/auth/logout', { method: 'POST' }),

    me: () =>
        request<UserResponse>('/auth/me'),
};

// ─── Activities ────────────────────────────────────────────────────────────

export interface Activity {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    activity_type: 'academic' | 'sports' | 'cultural' | 'social' | 'other';
    start_date: string;
    end_date: string;
    start_time_only: string | null;
    end_time_only: string | null;
    hours: number;
    max_participants: number | null;
    registration_open: boolean | null;
    status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    created_at: string;
    updated_at: string;
    organizer_name: string;
    creator_name: string;
}

export interface DashboardResponse {
    recent: Activity[];
    upcoming: Activity[];
}

export interface CreateActivityInput {
    title: string;
    description?: string | null;
    location?: string | null;
    activity_type: string;
    start_date: string;
    end_date: string;
    start_time_only?: string | null;
    end_time_only?: string | null;
    hours: number;
    max_participants?: number | null;
    organizer_id: string;
}

export interface UpdateActivityInput {
    title?: string;
    description?: string | null;
    location?: string | null;
    status?: string;
    registration_open?: boolean;
    max_participants?: number | null;
}

export interface Participation {
    id: string;
    status: string;
    registered_at: string | null;
    checked_in_at: string | null;
    checked_out_at: string | null;
    notes: string | null;
    activity: {
        id: string;
        title: string;
        description: string | null;
        location: string | null;
        start_date: string;
        end_date: string;
        hours: number;
        organizer_name: string;
        activity_level: string | null;
        status: string | null;
    };
}

export const activitiesApi = {
    dashboard: () =>
        request<DashboardResponse>('/activities/dashboard'),

    list: () =>
        request<Activity[]>('/activities'),

    get: (id: string) =>
        request<Activity>(`/activities/${id}`),

    create: (data: CreateActivityInput) =>
        request<{ activity_id: string; message: string }>('/activities', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: UpdateActivityInput) =>
        request<Activity>(`/activities/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/activities/${id}`, {
            method: 'DELETE',
        }),

    join: (id: string) =>
        request<{ message: string; participation_id: string }>(`/activities/${id}/join`, {
            method: 'POST',
        }),

    myParticipations: () =>
        request<Participation[]>('/activities/my/participations'),
};

// ─── Organizations ─────────────────────────────────────────────────────────

export interface Organization {
    id: string;
    name: string;
    code: string;
    description: string | null;
    organization_type: 'faculty' | 'office';
    status: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface Department {
    id: string;
    name: string;
    code: string;
    description: string | null;
    organization_id: string;
    organization_name?: string;
    status: boolean;
    created_at: string | null;
    updated_at: string | null;
    students_count?: number;
}

export interface CreateOrganizationInput {
    name: string;
    code: string;
    description?: string | null;
    organization_type: 'faculty' | 'office';
    status?: boolean;
}

export interface UpdateOrganizationInput {
    name?: string;
    code?: string;
    description?: string | null;
    organization_type?: 'faculty' | 'office';
    status?: boolean;
}

export const organizationsApi = {
    list: () =>
        request<{ all: Organization[]; grouped: { faculty: Organization[]; office: Organization[] } }>('/organizations'),

    listAdmin: () =>
        request<Organization[]>('/organizations/admin'),

    create: (data: CreateOrganizationInput) =>
        request<Organization>('/organizations/admin', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: UpdateOrganizationInput) =>
        request<Organization>(`/organizations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/organizations/${id}`, {
            method: 'DELETE',
        }),

    toggleStatus: (id: string) =>
        request<Organization>(`/organizations/${id}/toggle-status`, {
            method: 'POST',
        }),

    departments: (organizationId: string) =>
        request<Department[]>(`/organizations/${organizationId}/departments`),
};

// ─── Departments ───────────────────────────────────────────────────────────

export interface CreateDepartmentInput {
    name: string;
    code: string;
    description?: string | null;
    organization_id: string;
    status?: boolean;
}

export interface UpdateDepartmentInput {
    name?: string;
    code?: string;
    description?: string | null;
    status?: boolean;
}

export const departmentsApi = {
    list: () =>
        request<Department[]>('/departments'),

    create: (data: CreateDepartmentInput) =>
        request<Department>('/departments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: UpdateDepartmentInput) =>
        request<Department>(`/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/departments/${id}`, {
            method: 'DELETE',
        }),

    toggleStatus: (id: string) =>
        request<Department>(`/departments/${id}/toggle-status`, {
            method: 'POST',
        }),
};

// ─── Users ─────────────────────────────────────────────────────────────────

export interface UserListItem {
    id: string;
    student_id: string;
    email: string;
    prefix: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive' | 'suspended';
    department_id: string | null;
    created_at: string;
    last_login_at: string | null;
    department_name: string | null;
    organization_name: string | null;
}

export interface UserListResponse {
    users: UserListItem[];
    total: number;
}

export interface UpdateProfileInput {
    prefix?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    address?: string;
}

export const usersApi = {
    list: () =>
        request<UserListResponse>('/users'),

    get: (id: string) =>
        request<UserListItem>(`/users/${id}`),

    updateProfile: (data: UpdateProfileInput) =>
        request<{ message: string }>('/users/me/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ message: string }>('/users/me/password', {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        }),
};

// ─── Backwards-compatible re-exports ────────────────────────────────────────
// For any code that still imports `activities` or `organizations`
export const activities = activitiesApi;
export const organizations = organizationsApi;
