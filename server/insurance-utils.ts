// Insurance tier configurations for parcel delivery
export const INSURANCE_TIERS = {
  none: {
    name: "No Insurance",
    fee: 0, // NGN in kobo
    coverage: 0,
    description: "No insurance coverage",
  },
  basic: {
    name: "Basic Coverage",
    fee: 10000, // ₦100 in kobo
    coverage: 5000000, // ₦50,000 in kobo
    description: "Covers items up to ₦50,000",
  },
  standard: {
    name: "Standard Coverage",
    fee: 20000, // ₦200 in kobo
    coverage: 20000000, // ₦200,000 in kobo
    description: "Covers items up to ₦200,000",
  },
  premium: {
    name: "Premium Coverage",
    fee: 50000, // ₦500 in kobo
    coverage: 100000000, // ₦1,000,000 in kobo
    description: "Covers items up to ₦1,000,000",
  },
} as const;

export type InsuranceTier = keyof typeof INSURANCE_TIERS;

export function getInsuranceDetails(tier: InsuranceTier) {
  return INSURANCE_TIERS[tier];
}

export function calculateInsurance(declaredValue: number): {
  recommendedTier: InsuranceTier;
  tiers: typeof INSURANCE_TIERS;
} {
  let recommendedTier: InsuranceTier = "none";

  if (declaredValue > 0 && declaredValue <= 5000000) {
    recommendedTier = "basic";
  } else if (declaredValue > 5000000 && declaredValue <= 20000000) {
    recommendedTier = "standard";
  } else if (declaredValue > 20000000) {
    recommendedTier = "premium";
  }

  return {
    recommendedTier,
    tiers: INSURANCE_TIERS,
  };
}

export function validateInsurance(
  declaredValue: number,
  insuranceTier: InsuranceTier
): { valid: boolean; message?: string } {
  if (insuranceTier === "none") {
    return { valid: true };
  }

  const insurance = INSURANCE_TIERS[insuranceTier];

  if (declaredValue > insurance.coverage) {
    return {
      valid: false,
      message: `${insurance.name} only covers items up to ₦${insurance.coverage / 100}. Please choose a higher tier or reduce declared value.`,
    };
  }

  return { valid: true };
}
