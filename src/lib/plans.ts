export type Plan = "starter" | "pro" | "enterprise";

/** Lowest to highest — anything after the current plan is an upgrade. */
export const PLAN_ORDER: Plan[] = ["starter", "pro", "enterprise"];

/**
 * Display name and prices (EUR) per plan. Shared by the onboarding plan
 * picker and Settings, so the two can't drift apart. Yearly prices are
 * set by hand so they're clean numbers.
 */
export const PLAN_DETAILS: Record<Plan, { name: string; price: number; yearlyPrice: number }> = {
  starter: { name: "Starter", price: 9, yearlyPrice: 99 },
  pro: { name: "Pro", price: 19, yearlyPrice: 215 },
  enterprise: { name: "Enterprise", price: 250, yearlyPrice: 2850 },
};

/** How many bank accounts (including the primary one) each plan allows. null = no limit. */
export const BANK_ACCOUNT_LIMITS: Record<Plan, number | null> = {
  starter: 1,
  pro: 5,
  enterprise: null,
};

export function bankAccountLimit(plan: Plan | null | undefined): number | null {
  return BANK_ACCOUNT_LIMITS[plan ?? "starter"];
}
