import { describe, expect, it } from "vitest";
import {
  demoHomeownerEmail,
  demoLeads,
  demoPassword,
  demoRules,
  demoSalesEmail,
  isLoopbackDatabaseUrl,
  sampleAssessment,
  sampleQuoteSnapshot,
  sampleStatusToken,
  sampleStatusTokenHash,
} from "../../../prisma/seed-data.js";

describe("synthetic reviewer seed", () => {
  it("uses the requested synthetic brief data and deterministic qualification", () => {
    expect(demoLeads.map((lead) => [lead.id, lead.name, lead.ownerType, lead.monthlyBill, lead.monthlyUnits])).toEqual([
      ["LD-30881", "Prashant Wankhede", "OWNER", 3200, 340],
      ["LD-30902", "Rohit Meshram", "TENANT", 1900, 210],
      ["LD-30915", "Ayesha Siddiqui", "OWNER", 650, 85],
    ]);
    expect(demoLeads.map(sampleAssessment).map(({ baseline, recommendation }) => [
      baseline.band,
      recommendation.kw,
    ])).toEqual([
      ["HIGH", 3],
      ["LOW", null],
      ["LOW", 1],
    ]);
  });

  it("contains only local demo credentials and loopback seeding", () => {
    expect(demoSalesEmail).toBe("demo-sales@example.com");
    expect(demoHomeownerEmail).toBe("demo-homeowner@example.com");
    expect(demoPassword).toBe("DemoOnly!2026");
    expect(isLoopbackDatabaseUrl("postgresql://localhost/solar")).toBe(true);
    expect(isLoopbackDatabaseUrl("postgresql://127.0.0.1/solar")).toBe(true);
    expect(isLoopbackDatabaseUrl("postgresql://[::1]/solar")).toBe(true);
    expect(isLoopbackDatabaseUrl("postgresql://db.example.com/solar")).toBe(
      false,
    );
    expect(isLoopbackDatabaseUrl(undefined)).toBe(false);
  });

  it("seeds dated editable calculation rules and a valid synthetic quote", () => {
    expect(demoRules.map((rule) => [rule.category, rule.payload])).toEqual([
      ["PRICE", { pricePerKw: 65000 }],
      [
        "GENERATION",
        { generationPerKw: 1400, selfUse: 0.8, rate: 8 },
      ],
      [
        "SUBSIDY",
        { firstTwoPerKw: 30000, thirdKw: 18000, cap: 78000 },
      ],
    ]);
    expect(sampleQuoteSnapshot()).toMatchObject({
      ruleEffectiveDates: {
        PRICE: "2026-01-01",
        GENERATION: "2026-01-01",
        SUBSIDY: "2026-01-01",
      },
      calculation: {
        subsidy: 78000,
        netCost: 117000,
        yearlyGeneration: 4200,
      },
    });
  });

  it("stores only the hash of the fixed, clearly public demo status link", () => {
    expect(sampleStatusTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sampleStatusToken).toContain("public-demo");
    expect(sampleStatusTokenHash).not.toBe(sampleStatusToken);
  });
});
