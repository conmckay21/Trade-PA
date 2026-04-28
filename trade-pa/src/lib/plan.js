// ─────────────────────────────────────────────────────────────────────────
// TIER_CONFIG — single source of truth for all subscription tiers.
//
// Changes to pricing, caps, or user limits should happen here and nowhere
// else. Every conditional in the app (plan badge, usage bars, upgrade CTA,
// cap enforcement) reads from this config rather than hardcoding strings.
//
// Keys are the DB-stored tier identifiers used in the `subscriptions.plan`
// column and emitted from the Stripe webhook. The backend webhook must
// produce these exact strings: "solo", "pro_solo", "team", "business".
// Legacy key "pro" is mapped to "business" at read time (see checkSubscription).
// ─────────────────────────────────────────────────────────────────────────
export const TIER_CONFIG = {
  trial: {
    label: "Trial",
    badgeText: "TRIAL",
    priceText: "Free",
    priceDisplay: "Free 30-day trial",
    userLimit: 1,
    caps: { convos: 50, hf_hours: 0.5 }, // 30 min HF
    colorKey: "muted",
  },
  solo: {
    label: "Solo",
    badgeText: "SOLO",
    priceText: "£39",
    priceDisplay: "1 user · £39/mo",
    userLimit: 1,
    caps: { convos: 100, hf_hours: 1 },
    colorKey: "amber",
    stripePlanKey: "solo_monthly",
  },
  pro_solo: {
    label: "Pro Solo",
    badgeText: "PRO SOLO",
    priceText: "£59",
    priceDisplay: "1 user · £59/mo",
    userLimit: 1,
    caps: { convos: 200, hf_hours: 3 },
    colorKey: "amber",
    stripePlanKey: "pro_solo_monthly",
  },
  team: {
    label: "Team",
    badgeText: "TEAM",
    priceText: "£89",
    priceDisplay: "Up to 5 users · £89/mo",
    userLimit: 5,
    caps: { convos: 400, hf_hours: 4 },
    colorKey: "green",
    stripePlanKey: "team_monthly",
  },
  business: {
    label: "Business",
    badgeText: "BUSINESS",
    priceText: "£129",
    priceDisplay: "Up to 10 users · £129/mo",
    userLimit: 10,
    caps: { convos: 800, hf_hours: 8 },
    colorKey: "blue",
    stripePlanKey: "business_monthly",
  },
};

// Helper: normalize any tier key (handles legacy "pro" → "business" rename)
// to a canonical key that exists in TIER_CONFIG. Unknown keys fall back to solo.
export function normalizeTier(key) {
  if (key === "pro") return "business";          // legacy rename
  return TIER_CONFIG[key] ? key : "solo";
}

// Helper: look up a tier's config, with a safe fallback to Solo.
export function getTierConfig(key) {
  return TIER_CONFIG[normalizeTier(key)] || TIER_CONFIG.solo;
}
