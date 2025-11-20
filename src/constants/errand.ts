/*/ constants/errand.ts
import { Category, UrgencyType,StatusType } from '../types/errand';

export const CATEGORY_MULTIPLIERS: Record<Category, number> = {
  delivery: 1.0,
  printing: 1.2,
  shopping: 1.3,
  academic: 1.5,
  queue_standing: 1.4
};

export const URGENCY_FEES: Record<UrgencyType, number> = {
  standard: 0,
  urgent: 2000
};


export const VALID_CATEGORIES: Category[] = [
  'delivery',
  'printing',
  'shopping',
  'academic',
  'queue_standing'
];

export const VALID_STATUSES: StatusType[] = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'cancelled'
];

export const DISTANCE_RATE = 500; // TZS per km

export const RUNNER_SHARE = 0.75;
export const PLATFORM_SHARE = 0.25;

export const VALID_URGENCY: UrgencyType[] = ['standard', 'urgent'];
*/
