// utils/errandPricing.ts
import { Category, UrgencyType } from '../types/errand';
import { CATEGORY_MULTIPLIERS, URGENCY_FEES, RUNNER_SHARE, PLATFORM_SHARE, DISTANCE_RATE } from '../constants/errand';

export interface PricingBreakdown {
  finalPrice: number;
  runnerEarnings: number;
  platformFee: number;
}

/**
 * Calculate final price of errand including category, urgency, and distance.
 */
export function calculateErrandPrice(
  basePrice: number,
  category: Category,
  urgency: UrgencyType,
  distance: number
): number {
  const multiplier = CATEGORY_MULTIPLIERS[category];
  const urgencyFee = URGENCY_FEES[urgency];
  const distanceFee = Math.ceil(distance * DISTANCE_RATE);

  return Math.ceil(basePrice * multiplier + urgencyFee + distanceFee);
}

/**
 * Calculate runner earnings and platform fee from final price.
 */
export function calculateEarnings(finalPrice: number): Omit<PricingBreakdown, 'finalPrice'> {
  const runnerEarnings = finalPrice * RUNNER_SHARE;
  const platformFee = finalPrice * PLATFORM_SHARE;

  return {
    runnerEarnings: Math.ceil(runnerEarnings),
    platformFee: Math.ceil(platformFee)
  };
}

/**
 * Full pricing including final price, runner earnings, and platform fee.
 */
export function getFullPricing(
  basePrice: number,
  category: Category,
  urgency: UrgencyType,
  distance: number
): PricingBreakdown {
  const finalPrice = calculateErrandPrice(basePrice, category, urgency, distance);
  const { runnerEarnings, platformFee } = calculateEarnings(finalPrice);
  return { finalPrice, runnerEarnings, platformFee };
}
