import { describe, expect, it } from "vitest";
import {
  calculate,
  recommend,
  recommendForLead,
  score,
  sizing,
  subsidy,
} from "./engine.js";

describe("quote engine", () => {
  it("caps residential subsidy", () => expect(subsidy(5, true).amount).toBe(78000));
  it("rounds fractional subsidy down", () =>
    expect(subsidy(2.5, true).amount).toBe(60000));
  it("does not apply commercial subsidy", () =>
    expect(subsidy(3, false).amount).toBe(0));
  it("calculates savings and payback", () => {
    const result = calculate(3, true);
    expect(result.yearlyGeneration).toBe(4200);
  });
  it("flags constrained roofs", () =>
    expect(recommend(420, 18).note).toContain("Roof constraint"));
  it("keeps consumption sizing distinct from the usable-roof cap", () =>
    expect(sizing(340, 18)).toEqual({
      consumptionBasedKw: 3,
      roofLimitedKw: 1.5,
      recommendedKw: 1.5,
    }));
  it("does not turn a roof below the minimum system size into a 0 kW quote", () => {
    expect(sizing(340, 0.1)).toEqual({
      consumptionBasedKw: 3,
      roofLimitedKw: 0,
      recommendedKw: null,
    });
    expect(recommend(340, 0.1)).toMatchObject({
      kw: null,
      note: expect.stringContaining("insufficient"),
    });
  });
  it("allows exactly the minimum 0.5 kW roof-limited size", () =>
    expect(sizing(340, 5)).toEqual({
      consumptionBasedKw: 3,
      roofLimitedKw: 0.5,
      recommendedKw: 0.5,
    }));
  it("keeps tenants low readiness without sizing before owner consent", () => {
    const lead = { ownerType: "TENANT", monthlyUnits: 210, roofArea: 40 };
    expect(score(lead).band).toBe("LOW");
    expect(score(lead).nextAction).toBe("Short sales call");
    expect(recommendForLead("TENANT", 210, 40).kw).toBeNull();
  });
  it("keeps a small monthly bill in the low band with a 1 kW estimate", () => {
    const lead = { ownerType: "OWNER", monthlyUnits: 85, roofArea: 40 };
    expect(score(lead).band).toBe("LOW");
    expect(score(lead).nextAction).toBe("Short sales call");
    expect(recommendForLead("OWNER", 85, 40).kw).toBe(1);
  });
  it("keeps a typical homeowner in the high band with a 3 kW estimate", () => {
    const lead = { ownerType: "OWNER", monthlyUnits: 340, roofArea: 40 };
    expect(score(lead).band).toBe("HIGH");
    expect(recommendForLead("OWNER", 340, 40).kw).toBe(3);
  });
});
