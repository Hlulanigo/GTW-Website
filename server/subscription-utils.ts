import type { User } from "@shared/schema";

export interface SubscriptionPlan {
  tier: "free" | "premium" | "business";
  name: string;
  price: number; // in NGN
  priceInKobo: number;
  monthlyParcelLimit: number | null; // null means unlimited
  platformFeePercentage: number;
  features: string[];
  paystackPlanCode: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    tier: "free",
    name: "Free",
    price: 0,
    priceInKobo: 0,
    monthlyParcelLimit: 5,
    platformFeePercentage: 10,
    features: [
      "Up to 5 parcels per month",
      "10% platform fee",
      "Basic support",
      "Standard matching",
    ],
    paystackPlanCode: "",
  },
  premium: {
    tier: "premium",
    name: "Premium",
    price: 999, // 999 NGN (~$0.60)
    priceInKobo: 99900,
    monthlyParcelLimit: 20,
    platformFeePercentage: 5,
    features: [
      "Up to 20 parcels per month",
      "5% platform fee",
      "Priority support",
      "Priority matching",
      "Verified badge",
    ],
    paystackPlanCode: "PLN_premium_monthly",
  },
  business: {
    tier: "business",
    name: "Business",
    price: 2999, // 2999 NGN (~$1.80)
    priceInKobo: 299900,
    monthlyParcelLimit: null, // unlimited
    platformFeePercentage: 3,
    features: [
      "Unlimited parcels",
      "3% platform fee",
      "Dedicated support",
      "Priority matching",
      "API access",
      "Business verified badge",
    ],
    paystackPlanCode: "PLN_business_monthly",
  },
};

export function getSubscriptionPlan(tier: "free" | "premium" | "business"): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

export function canCreateParcel(user: User): { allowed: boolean; reason?: string } {
  const plan = getSubscriptionPlan(user.subscriptionTier || "free");
  
  // Check if subscription is active
  if (user.subscriptionStatus !== "active") {
    return { allowed: false, reason: "Your subscription is not active. Please update your subscription." };
  }

  // Check if subscription has expired
  if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()) {
    return { allowed: false, reason: "Your subscription has expired. Please renew to continue." };
  }

  // Check monthly limit
  if (plan.monthlyParcelLimit !== null) {
    const currentCount = user.monthlyParcelCount || 0;
    if (currentCount >= plan.monthlyParcelLimit) {
      return {
        allowed: false,
        reason: `You've reached your monthly limit of ${plan.monthlyParcelLimit} parcels. Upgrade to Premium or Business for more parcels.`,
      };
    }
  }

  return { allowed: true };
}

export function calculatePlatformFee(
  amount: number,
  userTier: "free" | "premium" | "business"
): { platformFee: number; carrierAmount: number; platformFeePercentage: number } {
  const plan = getSubscriptionPlan(userTier);
  const platformFee = Math.round(amount * (plan.platformFeePercentage / 100));
  const carrierAmount = amount - platformFee;

  return {
    platformFee,
    carrierAmount,
    platformFeePercentage: plan.platformFeePercentage,
  };
}

export function shouldResetParcelCount(user: User): boolean {
  if (!user.lastParcelResetDate) return true;

  const lastReset = new Date(user.lastParcelResetDate);
  const now = new Date();

  // Reset if it's been more than a month (30 days)
  const daysSinceReset = Math.floor(
    (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceReset >= 30;
}

export function getSubscriptionStatus(user: User): {
  tier: string;
  status: string;
  parcelsRemaining: number | null;
  platformFeePercentage: number;
  daysUntilRenewal: number | null;
} {
  const plan = getSubscriptionPlan(user.subscriptionTier || "free");
  const currentCount = user.monthlyParcelCount || 0;
  const parcelsRemaining = plan.monthlyParcelLimit
    ? plan.monthlyParcelLimit - currentCount
    : null;

  let daysUntilRenewal: number | null = null;
  if (user.subscriptionEndDate) {
    const endDate = new Date(user.subscriptionEndDate);
    const now = new Date();
    daysUntilRenewal = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    tier: plan.name,
    status: user.subscriptionStatus || "active",
    parcelsRemaining,
    platformFeePercentage: plan.platformFeePercentage,
    daysUntilRenewal,
  };
}
