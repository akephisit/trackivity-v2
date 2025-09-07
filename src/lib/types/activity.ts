export type ActivityType = 'Academic' | 'Sports' | 'Cultural' | 'Social' | 'Other';
export type ActivityStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
export type ParticipationStatus = 'registered' | 'checked_in' | 'checked_out' | 'completed';
export type ActivityLevel = 'faculty' | 'university';

export interface Activity {
	id: string;
	title: string;
	description: string;
	location: string;
	start_time: string; // Full ISO datetime from backend
	end_time: string; // Full ISO datetime from backend
	max_participants?: number;
	participant_count: number;
	view_count?: number;
	status: ActivityStatus;
	organization_id?: string;
	organization_name?: string;
	organizer_id?: string;
	organizer_name?: string;
	created_by: string;
	created_by_name: string;
	created_at: string;
	updated_at: string;
	is_registered: boolean;
	user_participation_status?: ParticipationStatus;
	is_eligible: boolean;
	eligible_organizations: string[];
	activity_type: ActivityType;
	hours: number;
	organizer: string;
	organizerType: 'หน่วยงาน' | 'มหาวิทยาลัย';
	academic_year: string;
	activity_level: ActivityLevel;
	require_score?: boolean;
}

// For creating new activities
export interface ActivityCreateData {
	title: string;
	description: string;
	location: string;
	start_time: string; // ISO datetime
	end_time: string; // ISO datetime
	max_participants?: number;
	organization_id?: string;
	organizer_id?: string;
	department_id?: string;
}

// For updating activities
export interface ActivityUpdateData {
	title?: string;
	description?: string;
	location?: string;
	start_time?: string;
	end_time?: string;
	max_participants?: number;
	status?: ActivityStatus;
	organization_id?: string;
	organizer_id?: string;
	department_id?: string;
}

// Participation data
export interface Participation {
	id: string;
	user_id: string;
	user_name: string;
	student_id: string;
	email: string;
	department_name?: string;
	status: ParticipationStatus;
	registered_at: string;
	checked_in_at?: string;
	checked_out_at?: string;
	notes?: string;
}


export interface ActivityApiResponse {
	status: string;
	data?: Activity | Activity[];
	error?: string;
	message?: string;
}
