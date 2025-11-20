// types/models.ts
import { Category, Urgency, ErrandStatus } from './errand';

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