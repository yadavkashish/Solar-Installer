import crypto from "node:crypto";
import {
  calculate,
  DEMO_RULES,
  recommendForLead,
  score,
} from "../apps/api/src/engine.js";

export const demoSalesEmail = "demo-sales@example.com";
export const demoHomeownerEmail = "demo-homeowner@example.com";
export const demoPassword = "DemoOnly!2026";
export const sampleStatusToken =
  "public-demo-customer-status-link-LD-30881-2026";
export const sampleStatusTokenHash = crypto
  .createHash("sha256")
  .update(sampleStatusToken)
  .digest("hex");

export const demoLeads = [
  {
    id: "LD-30881",
    name: "Prashant Wankhede",
    email: "sample-ld30881@example.com",
    ownerType: "OWNER",
    monthlyBill: 3200,
    monthlyUnits: 340,
    roofArea: 40,
    pincode: "440001",
    sampleScenario: "Synthetic brief example: owner, typical usage, high readiness",
  },
  {
    id: "LD-30902",
    name: "Rohit Meshram",
    email: "sample-ld30902@example.com",
    ownerType: "TENANT",
    monthlyBill: 1900,
    monthlyUnits: 210,
    roofArea: 40,
    pincode: "440010",
    sampleScenario: "Synthetic brief example: tenant, short owner-confirmation call",
  },
  {
    id: "LD-30915",
    name: "Ayesha Siddiqui",
    email: "sample-ld30915@example.com",
    ownerType: "OWNER",
    monthlyBill: 650,
    monthlyUnits: 85,
    roofArea: 40,
    pincode: "440022",
    sampleScenario: "Synthetic brief example: owner, low monthly usage",
  },
] as const;

export const demoRules = [
  {
    id: "PRICE-2026",
    category: "PRICE",
    payload: { pricePerKw: 65000 },
    version: "price-2026.1",
  },
  {
    id: "GENERATION-2026",
    category: "GENERATION",
    payload: { generationPerKw: 1400, selfUse: 0.8, rate: 8 },
    version: "generation-2026.1",
  },
  {
    id: "SUBSIDY-2026",
    category: "SUBSIDY",
    payload: { firstTwoPerKw: 30000, thirdKw: 18000, cap: 78000 },
    version: "subsidy-2026.1",
  },
] as const;

export function isLoopbackDatabaseUrl(connectionString: string | undefined) {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1", "::1"].includes(
      url.hostname.replace(/^\[|\]$/g, ""),
    );
  } catch {
    return false;
  }
}

export function sampleAssessment(lead: (typeof demoLeads)[number]) {
  const baseline = score(lead);
  return {
    baseline,
    recommendation: recommendForLead(
      lead.ownerType,
      lead.monthlyUnits,
      lead.roofArea,
    ),
  };
}

export function sampleQuoteSnapshot() {
  return {
    leadId: "LD-30881",
    issuedAt: "2026-01-01T00:00:00.000Z",
    ruleVersion: demoRules.map((rule) => rule.version).join(" | "),
    ruleEffectiveDates: {
      PRICE: "2026-01-01",
      GENERATION: "2026-01-01",
      SUBSIDY: "2026-01-01",
    },
    calculation: calculate(3, true, DEMO_RULES),
    survey: {
      usableRoofArea: 40,
      consumptionBasedKw: 3,
      roofLimitedKw: 4,
      recommendedKw: 3,
    },
  };
}
