// types/errand.ts - Recommended approach

// Using enum approach for better TypeScript support
export enum Category {
  DELIVERY = 'delivery',
  SHOPPING = 'shopping',
  FOOD_DELIVERY = 'food_delivery',
  DOCUMENTS = 'documents',
  OTHER = 'other'
}

export enum Urgency {
  STANDARD = 'standard',
  URGENT = 'urgent',
  ASAP = 'asap'
}

export enum ErrandStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// No need for duplicate type declarations when using enums
// The enums themselves serve as both types and values

// Pricing interface
export interface PricingBreakdown {
  basePrice: number;
  platformFee: number;
  urgencyFee: number;
  distanceFee: number;
  runnerEarnings: number;
  finalPrice: number;
}

// Errand creation interface
export interface CreateErrandData {
  customerId: number;
  title: string;
  description?: string;
  category: Category;
  location_from: string;
  location_to: string;
  budget: number;
  urgency: Urgency; // Use Urgency enum instead of UrgencyType
  distance?: number;
  estimated_duration_min?: number;
}