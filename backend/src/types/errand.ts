// types/errand.ts

// Categories of errands
export type Category =
  | 'delivery'
  | 'printing'
  | 'shopping'
  | 'academic'
  | 'queue_standing';

// Urgency levels
export type UrgencyType = 'standard' | 'urgent';

// Errand statuses
export type StatusType =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
