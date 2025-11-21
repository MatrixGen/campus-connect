import { Optional } from 'sequelize';

// Runner Model Interface
export interface RunnerAttributes {
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
}

// Use this for creation to allow null values
export interface RunnerCreationAttributes {
  user_id: number;
  areas_covered: string[];
  transportation_mode: string;
  is_available?: boolean;
  is_approved?: boolean;
  rating?: number;
  completed_errands?: number;
  earnings?: number;
  total_distance_covered?: number;
  average_response_time?: number;
  cancellation_rate?: number;
  documents_verified?: boolean;
  id_card_url?: string | null;
  student_card_url?: string | null;
  rejection_reason?: string | null;
  approved_at?: Date | null;
  last_active_at?: Date | null;
}