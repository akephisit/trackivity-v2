/**
 * QR Code Scanner Status Handling Utilities
 * Provides comprehensive status mapping, UI feedback, and message management
 */

export type StatusCategory = 'success' | 'already_done' | 'restricted' | 'flow_violation' | 'error';

export type StatusCode = 
  // Success statuses
  | 'CHECKIN_SUCCESS'
  | 'CHECKOUT_SUCCESS'
  
  // Already done statuses
  | 'ALREADY_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  | 'ALREADY_COMPLETED'
  | 'REPEATED_DUPLICATE_ATTEMPT'
  
  // Restricted access statuses
  | 'FACULTY_RESTRICTION'
  | 'ACTIVITY_NOT_ONGOING'
  | 'ACTIVITY_EXPIRED'
  | 'ACTIVITY_NOT_STARTED'
  | 'MAX_PARTICIPANTS_REACHED'
  | 'NOT_CHECKED_IN'
  | 'NOT_CHECKED_IN_YET'
  | 'STUDENT_ACCOUNT_INACTIVE'
  | 'QR_EXPIRED'
  | 'INVALID_CHECKOUT_STATUS'
  
  // Error statuses
  | 'ACTIVITY_NOT_FOUND'
  | 'STUDENT_NOT_FOUND'
  | 'QR_INVALID'
  | 'DEPARTMENT_NOT_FOUND'
  | 'NO_DEPARTMENT'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface StatusConfig {
  category: StatusCategory;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  iconColor: string;
  duration: number; // Display duration in milliseconds
  sound?: string; // Sound file name (optional)
  vibration?: number[]; // Vibration pattern (optional)
}

export interface QRScanResult {
  success: boolean;
  message: string;
  category?: StatusCategory;
  error?: {
    code: StatusCode;
    message: string;
    category: StatusCategory;
    details?: Record<string, any>;
  };
  data?: {
    user_name?: string;
    student_id?: string;
    participation_status?: string;
    checked_in_at?: string;
    checked_out_at?: string;
    activity_title?: string;
    is_new_participation?: boolean;
    previous_check_in?: string;
    is_duplicate?: boolean; // New flag for flexible flow
    is_direct_checkout?: boolean; // New flag for direct checkout
  };
}

/**
 * Status configuration mapping
 * Maps status codes to visual and behavioral configurations
 */
export const STATUS_CONFIG: Record<StatusCode, StatusConfig> = {
  // Success statuses (Green)
  CHECKIN_SUCCESS: {
    category: 'success',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check-circle',
    iconColor: 'text-green-600',
    duration: 4000,
    sound: 'success',
    vibration: [200, 100, 200]
  },
  CHECKOUT_SUCCESS: {
    category: 'success',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check-circle',
    iconColor: 'text-green-600',
    duration: 4000,
    sound: 'success',
    vibration: [200, 100, 200]
  },

  // Already done statuses (Minimal/Success for duplicates)
  ALREADY_CHECKED_IN: {
    category: 'success', // Changed from 'already_done' to 'success' for less intrusive feedback
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'info-circle',
    iconColor: 'text-green-600',
    duration: 3000, // Reduced duration
    sound: 'info',
    vibration: [100] // Minimal vibration
  },
  ALREADY_CHECKED_OUT: {
    category: 'success', // Changed from 'flow_violation' to 'success' for duplicates
    color: 'text-green-700',
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-200',
    icon: 'info-circle',
    iconColor: 'text-green-600',
    duration: 3000, // Reduced duration
    sound: 'info',
    vibration: [100] // Minimal vibration
  },
  ALREADY_COMPLETED: {
    category: 'flow_violation',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'x-circle',
    iconColor: 'text-red-600',
    duration: 7000,
    sound: 'error',
    vibration: [400, 200, 400, 200, 400]
  },
  REPEATED_DUPLICATE_ATTEMPT: {
    category: 'already_done',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'alert-triangle',
    iconColor: 'text-orange-600',
    duration: 8000,
    sound: 'warning',
    vibration: [300, 100, 300, 100, 300]
  },

  // Restricted access statuses (Orange/Warning)
  FACULTY_RESTRICTION: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'shield-exclamation',
    iconColor: 'text-orange-600',
    duration: 6000,
    sound: 'warning',
    vibration: [300, 200, 300]
  },
  ACTIVITY_NOT_ONGOING: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'clock',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  ACTIVITY_EXPIRED: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'clock-x',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  ACTIVITY_NOT_STARTED: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'clock',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  MAX_PARTICIPANTS_REACHED: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'users-x',
    iconColor: 'text-orange-600',
    duration: 6000,
    sound: 'warning',
    vibration: [300, 200, 300]
  },
  NOT_CHECKED_IN: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'user-check',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  NOT_CHECKED_IN_YET: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'user-check',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  STUDENT_ACCOUNT_INACTIVE: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'user-x',
    iconColor: 'text-orange-600',
    duration: 6000,
    sound: 'warning',
    vibration: [300, 200, 300]
  },
  QR_EXPIRED: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'qr-code-off',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },
  INVALID_CHECKOUT_STATUS: {
    category: 'restricted',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'x-circle',
    iconColor: 'text-orange-600',
    duration: 5000,
    sound: 'warning',
    vibration: [200, 200]
  },

  // Error statuses (Red)
  ACTIVITY_NOT_FOUND: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'alert-triangle',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  },
  STUDENT_NOT_FOUND: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'user-x',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  },
  QR_INVALID: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'qr-code-off',
    iconColor: 'text-red-600',
    duration: 5000,
    sound: 'error',
    vibration: [300, 300]
  },
  DEPARTMENT_NOT_FOUND: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'building-x',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  },
  NO_DEPARTMENT: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'building-x',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  },
  AUTH_ERROR: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'shield-x',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  },
  VALIDATION_ERROR: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'alert-triangle',
    iconColor: 'text-red-600',
    duration: 5000,
    sound: 'error',
    vibration: [300, 300]
  },
  INTERNAL_ERROR: {
    category: 'error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'alert-triangle',
    iconColor: 'text-red-600',
    duration: 6000,
    sound: 'error',
    vibration: [500, 200, 500]
  }
};

/**
 * Maps API error codes to our standardized status codes
 */
export function mapApiErrorToStatusCode(apiErrorCode: string): StatusCode {
  const mapping: Record<string, StatusCode> = {
    // Success (handled separately)
    
    // Already done
    'ALREADY_CHECKED_IN': 'ALREADY_CHECKED_IN',
    'ALREADY_CHECKED_OUT': 'ALREADY_CHECKED_OUT', 
    'ALREADY_COMPLETED': 'ALREADY_COMPLETED',
    'REPEATED_DUPLICATE_ATTEMPT': 'REPEATED_DUPLICATE_ATTEMPT',
    
    // Restricted
    'FACULTY_RESTRICTION': 'FACULTY_RESTRICTION',
    'NOT_ONGOING': 'ACTIVITY_NOT_ONGOING',
    'ACTIVITY_NOT_ONGOING': 'ACTIVITY_NOT_ONGOING',
    'ACTIVITY_EXPIRED': 'ACTIVITY_EXPIRED',
    'ACTIVITY_NOT_STARTED': 'ACTIVITY_NOT_STARTED',
    'MAX_PARTICIPANTS_REACHED': 'MAX_PARTICIPANTS_REACHED',
    'NOT_REGISTERED': 'NOT_CHECKED_IN',
    'NOT_CHECKED_IN': 'NOT_CHECKED_IN',
    'NOT_CHECKED_IN_YET': 'NOT_CHECKED_IN_YET',
    'STUDENT_ACCOUNT_INACTIVE': 'STUDENT_ACCOUNT_INACTIVE',
    'QR_EXPIRED': 'QR_EXPIRED',
    'INVALID_STATUS': 'INVALID_CHECKOUT_STATUS',
    'INVALID_CHECKOUT_STATUS': 'INVALID_CHECKOUT_STATUS',
    
    // Errors
    'NOT_FOUND': 'ACTIVITY_NOT_FOUND',
    'ACTIVITY_NOT_FOUND': 'ACTIVITY_NOT_FOUND',
    'USER_NOT_FOUND': 'STUDENT_NOT_FOUND',
    'STUDENT_NOT_FOUND': 'STUDENT_NOT_FOUND',
    'QR_INVALID': 'QR_INVALID',
    'DEPARTMENT_NOT_FOUND': 'DEPARTMENT_NOT_FOUND',
    'NO_DEPARTMENT': 'NO_DEPARTMENT',
    'AUTH_ERROR': 'AUTH_ERROR',
    'VALIDATION_ERROR': 'VALIDATION_ERROR',
    'INTERNAL_ERROR': 'INTERNAL_ERROR'
  };

  return mapping[apiErrorCode] || 'INTERNAL_ERROR';
}

/**
 * Gets status configuration for a given status code
 */
export function getStatusConfig(statusCode: StatusCode): StatusConfig {
  return STATUS_CONFIG[statusCode];
}

/**
 * Plays audio feedback for a status
 */
export function playStatusSound(statusCode: StatusCode): void {
  if (typeof window === 'undefined') return;
  
  const config = getStatusConfig(statusCode);
  if (!config.sound) return;
  
  try {
    const audio = new Audio(`/sounds/${config.sound}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(console.warn);
  } catch (e) {
    console.warn('Could not play status sound:', e);
  }
}

/**
 * Triggers haptic feedback for a status
 */
export function triggerStatusVibration(statusCode: StatusCode): void {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  
  const config = getStatusConfig(statusCode);
  if (!config.vibration) return;
  
  try {
    navigator.vibrate(config.vibration);
  } catch (e) {
    console.warn('Could not trigger vibration:', e);
  }
}

/**
 * Formats additional details for display
 */
export function formatStatusDetails(details?: Record<string, any>): string[] {
  if (!details) return [];
  
  const formatted: string[] = [];
  
  if (details.previousCheckIn) {
    formatted.push(`เช็คอินก่อนหน้า: ${formatDateTime(details.previousCheckIn)}`);
  }
  
  if (details.previousCheckOut) {
    formatted.push(`เช็คเอาท์ก่อนหน้า: ${formatDateTime(details.previousCheckOut)}`);
  }
  
  if (details.maxParticipants && details.currentParticipants) {
    formatted.push(`ผู้เข้าร่วม: ${details.currentParticipants}/${details.maxParticipants}`);
  }
  
  if (details.activityStatus) {
    formatted.push(`สถานะกิจกรรม: ${getActivityStatusText(details.activityStatus)}`);
  }
  
  if (details.userStatus) {
    formatted.push(`สถานะบัญชี: ${getUserStatusText(details.userStatus)}`);
  }
  
  if (details.flowMessage) {
    formatted.push(`${details.flowMessage}`);
  }
  
  if (details.advice) {
    formatted.push(`💡 ${details.advice}`);
  }
  
  return formatted;
}

/**
 * Formats date time for Thai display
 */
function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      year: '2-digit',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'ไม่ระบุ';
  }
}

/**
 * Gets Thai text for activity status
 */
function getActivityStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'draft': 'ร่าง',
    'published': 'เผยแพร่',
    'ongoing': 'กำลังดำเนินการ', 
    'completed': 'สิ้นสุด',
    'cancelled': 'ยกเลิก'
  };
  return statusMap[status] || status;
}

/**
 * Gets Thai text for user status
 */
function getUserStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'ใช้งานได้',
    'inactive': 'ไม่ได้ใช้งาน',
    'suspended': 'ถูกระงับ'
  };
  return statusMap[status] || status;
}

/**
 * Processes QR scan result and returns standardized format
 */
export function processQRScanResult(result: any): QRScanResult {
  if (result.success === true) {
    return {
      success: true,
      message: result.message || 'สแกนสำเร็จ',
      category: 'success' as StatusCategory,
      data: result.data
    };
  } else {
    const errorCode = result.error?.code || 'INTERNAL_ERROR';
    const statusCode = mapApiErrorToStatusCode(errorCode);
    const config = getStatusConfig(statusCode);
    
    return {
      success: false,
      message: result.error?.message || result.message || 'เกิดข้อผิดพลาด',
      category: config.category,
      error: {
        code: statusCode,
        message: result.error?.message || result.message || 'เกิดข้อผิดพลาด',
        category: config.category,
        details: result.error?.details
      }
    };
  }
}