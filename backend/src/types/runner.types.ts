export interface RunnerRegistrationData {
  areas_covered: string[];
  transportation_mode: string;
  id_card_url?: string;
  student_card_url?: string;
}

export interface RunnerUpdateData {
  areas_covered?: string[];
  transportation_mode?: string;
  is_available?: boolean;
  id_card_url?: string | null;
  student_card_url?: string | null;
}

export interface RunnerStats {
  completed_errands: number;
  active_errands: number;
  total_earnings: number;
  average_rating?: number;
  total_distance_covered?: number;
  cancellation_rate?: number;
}

export interface EarningsBreakdown {
  period: string;
  total_earnings: number;
  total_errands: number;
  platform_fees: number;
  transactions: any[];
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface RunnerWithUser {
  id: number;
  user_id: number;
  areas_covered: string[];
  transportation_mode: string;
  is_available: boolean;
  is_approved: boolean;
  rating: number;
  completed_errands: number;
  earnings: number;
  total_distance_covered: number;
  average_response_time: number;
  cancellation_rate: number;
  documents_verified: boolean;
  id_card_url?: string | null;
  student_card_url?: string | null;
  rejection_reason?: string | null;
  approved_at?: Date | null;
  last_active_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  user?: {
    id: number;
    full_name: string;
    phone_number: string;
    email?: string;
    student_id?: string;
    user_type: string;
    verification_status: string;
    avatar_url?: string;
  };
}