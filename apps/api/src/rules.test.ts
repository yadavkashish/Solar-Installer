import { describe, expect, it } from "vitest";
import {
  RuleConfigurationError,
  selectEffectiveRule,
  validateRuleWindows,
} from "./repository.js";
import { calculate, DEMO_RULES, score } from "./engine.js";

const january = {
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: new Date("2026-02-01T00:00:00.000Z"),
};
const february = {
  effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
  effectiveTo: null,
};

describe("dated quote rules", () => {
  it("uses inclusive start and exclusive end boundaries", () => {
    expect(
      selectEffectiveRule(
        "PRICE",
        [january, february],
        new Date("2026-01-31T23:59:59.999Z"),
      ),
    ).toBe(january);
    expect(
      selectEffectiveRule(
        "PRICE",
        [january, february],
        new Date("2026-02-01T00:00:00.000Z"),
      ),
    ).toBe(february);
  });
  it("rejects missing and overlapping rules", () => {
    expect(() => selectEffectiveRule("PRICE", [], new Date())).toThrow(
      RuleConfigurationError,
    );
    expect(() =>
      validateRuleWindows([
        {
          category: "PRICE",
          effectiveFrom: january.effectiveFrom,
          effectiveTo: null,
        },
        {
          category: "PRICE",
          effectiveFrom: february.effectiveFrom,
          effectiveTo: null,
        },
      ]),
    ).toThrow(RuleConfigurationError);
  });
  it("gives tenants and low-readiness leads a short-call action", () => {
    expect(
      score({
        ownerType: "TENANT",
        monthlyUnits: 500,
        roofArea: 60,
        tariff: "Residential",
      }).nextAction,
    ).toBe("Short sales call");
    expect(
      score({
        ownerType: "OWNER",
        monthlyUnits: 20,
        roofArea: 5,
        tariff: "Residential",
      }).nextAction,
    ).toBe("Short sales call");
  });

  it("keeps an issued calculation stable when a later rule changes", () => {
    const issued = calculate(3, true, DEMO_RULES);
    const revised = calculate(3, true, {
      ...DEMO_RULES,
      pricePerKw: 72000,
      version: "price-2027.1",
    });

    expect(issued.grossCost).toBe(195000);
    expect(revised.grossCost).toBe(216000);
    expect(issued.assumptions.version).toBe("demo-2026.1");
  });
});
