import { Category, Urgency, PricingBreakdown } from '../types/errand';

export function getFullPricing(
  basePrice: number,
  category: Category,
  urgency: Urgency,
  distance?: number
): PricingBreakdown {
  // Platform fee percentage (15%)
  const platformFeeRate = 0.15;
  
  // Urgency multipliers
  const urgencyMultipliers = {
    [Urgency.STANDARD]: 1.0,
    [Urgency.URGENT]: 1.3,
    [Urgency.ASAP]: 1.6
  };
  
  // Distance fee (per km)
  const distanceRate = 0.5;
  
  // Category-based adjustments
  const categoryMultipliers = {
    [Category.DELIVERY]: 1.0,
    [Category.SHOPPING]: 1.2,
    [Category.FOOD_DELIVERY]: 1.1,
    [Category.DOCUMENTS]: 1.0,
    [Category.OTHER]: 1.0
  };
  
  // Calculate components
  const urgencyMultiplier = urgencyMultipliers[urgency];
  const categoryMultiplier = categoryMultipliers[category];
  const distanceFee = distance || 0* distanceRate;
  
  const adjustedBasePrice = basePrice * categoryMultiplier;
  const urgencyFee = (adjustedBasePrice * urgencyMultiplier) - adjustedBasePrice;
  const priceBeforePlatformFee = adjustedBasePrice + urgencyFee + distanceFee;
  const platformFee = priceBeforePlatformFee * platformFeeRate;
  const finalPrice = priceBeforePlatformFee + platformFee;
  const runnerEarnings = priceBeforePlatformFee - platformFee;
  
  return {
    basePrice: Math.round(adjustedBasePrice * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    urgencyFee: Math.round(urgencyFee * 100) / 100,
    distanceFee: Math.round(distanceFee * 100) / 100,
    runnerEarnings: Math.round(runnerEarnings * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100
  };
}