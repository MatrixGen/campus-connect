// types/models.ts
import { Category, Urgency, ErrandStatus } from './errand';
import { Optional } from 'sequelize';

// Errand model attributes
export interface ErrandAttributes {
  id: number;
  customer_id: number;
  runner_id?: number;
  title: string;
  description?: string;
  category: string; // Store as string in DB, but use Category enum in code
  location_from: string;
  location_to: string;
  base_price: number;
  final_price: number;
  urgency: string; // Store as string in DB, but use UrgencyType enum in code
  distance_km?: number;
  estimated_duration_min?: number;
  status: string; // Store as string in DB, but use ErrandStatus enum in code
  cancellation_reason?: string;
  cancelled_by?: number;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ErrandCreationAttributes {
  customer_id: number;
  runner_id?: number;
  title: string;
  description?: string;
  category: string;
  location_from: string;
  location_to: string;
  base_price: number;
  final_price: number;
  urgency: string;
  distance_km?: number;
  estimated_duration_min?: number;
  status: string;
  cancellation_reason?: string;
  cancelled_by?: number;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
}

// User Model Interface
export interface UserAttributes {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  user_type: 'customer' | 'runner' | 'both';
  verification_status: string;
  student_id?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at'> {}

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

export interface RunnerCreationAttributes extends Optional<RunnerAttributes, 'id' | 'created_at' | 'updated_at' | 'approved_at' | 'last_active_at'> {}

// Errand Model Interface
export interface ErrandAttributes {
  id: number;
  title: string;
  category: string;
  status: string;
  customer_id: number;
  runner_id?: number ;
  created_at: Date;
  updated_at: Date;
}

// Transaction Model Interface
export interface TransactionAttributes {
  id: number;
  amount: number;
  runner_earnings: number;
  platform_fee: number;
  payment_method: string;
  payment_status: string;
  runner_id: number;
  errand_id?: number | null;
  completed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}