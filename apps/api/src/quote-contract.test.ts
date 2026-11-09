import { describe, expect, it } from "vitest";
import { quoteView } from "./repository.js";

const snapshot = {
  leadId: "LD-test",
  ruleVersion: "demo-2026.1",
  calculation: {
    capacityKw: 3,
    grossCost: 195000,
    subsidy: 78000,
    netCost: 117000,
    yearlyGeneration: 4200,
    yearlySavings: 26880,
    paybackYears: 4.4,
    assumptions: {
      pricePerKw: 65000,
      generationPerKw: 1400,
      selfUse: 0.8,
      rate: 8,
      effectiveFrom: "2026-01-01",
      version: "demo-2026.1",
      subsidyNote: "Demo",
    },
  },
};

describe("saved quote response", () => {
  it("has no renderable saved quote before a quote exists", () => {
    const quote = undefined;
    expect(quote ? quoteView(quote) : null).toBeNull();
  });
  it("maps the persisted snapshot to the UI quote contract", () => {
    expect(
      quoteView({
        id: "Q-test",
        leadId: "LD-test",
        version: 1,
        createdAt: new Date(),
        snapshot,
      }),
    ).toMatchObject({ id: "Q-test", calculation: { capacityKw: 3 } });
  });
  it("rejects a malformed persisted snapshot instead of returning undefined calculation", () => {
    expect(() =>
      quoteView({
        id: "Q-test",
        leadId: "LD-test",
        version: 1,
        createdAt: new Date(),
        snapshot: {},
      }),
    ).toThrow();
  });
});
