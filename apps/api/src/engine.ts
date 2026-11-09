export type Rules = {
  pricePerKw: number;
  generationPerKw: number;
  selfUse: number;
  rate: number;
  firstTwoPerKw: number;
  thirdKw: number;
  cap: number;
  effectiveFrom: string;
  version: string;
};
export const DEMO_RULES: Rules = {
  pricePerKw: 65000,
  generationPerKw: 1400,
  selfUse: 0.8,
  rate: 8,
  firstTwoPerKw: 30000,
  thirdKw: 18000,
  cap: 78000,
  effectiveFrom: "2026-01-01",
  version: "demo-2026.1",
};
export function subsidy(
  kw: number,
  residential: boolean,
  rules: Pick<Rules, "firstTwoPerKw" | "thirdKw" | "cap"> = DEMO_RULES,
) {
  if (!residential)
    return {
      amount: 0,
      reason: "Commercial or ambiguous tariff: sales review required.",
    };
  const eligible = Math.floor(kw);
  const amount = Math.min(
    rules.cap,
    Math.min(eligible, 2) * rules.firstTwoPerKw +
      (eligible >= 3 ? rules.thirdKw : 0),
  );
  return {
    amount,
    reason: `Demo residential rule: first 2 kW at ₹${rules.firstTwoPerKw.toLocaleString("en-IN")}/kW, third kW at ₹${rules.thirdKw.toLocaleString("en-IN")}; fractional capacity is rounded down.`,
  };
}
export function calculate(
  kw: number,
  residential: boolean,
  rules = DEMO_RULES,
) {
  const gross = Math.round(kw * rules.pricePerKw);
  const sub = subsidy(kw, residential, rules);
  const generation = Math.round(kw * rules.generationPerKw);
  const savings = Math.round(generation * rules.selfUse * rules.rate);
  const net = gross - sub.amount;
  return {
    capacityKw: kw,
    grossCost: gross,
    subsidy: sub.amount,
    netCost: net,
    yearlyGeneration: generation,
    yearlySavings: savings,
    paybackYears: savings > 0 ? +(net / savings).toFixed(1) : null,
    assumptions: { ...rules, subsidyNote: sub.reason },
  };
}
export function score(lead: {
  ownerType: string;
  monthlyUnits: number | null;
  roofArea: number | null;
  tariff?: string | null;
}) {
  let points = 0;
  const reasons: string[] = [];
  if (lead.ownerType === "OWNER") {
    points += 45;
    reasons.push("Owner can proceed with a rooftop decision.");
  } else reasons.push("Tenant: schedule a short sales call; do not reject.");
  if ((lead.monthlyUnits ?? 0) >= 200) {
    points += 30;
    reasons.push("Usage supports a meaningful solar offset.");
  } else reasons.push("Lower usage makes savings modest.");
  if ((lead.roofArea ?? 0) >= 25) {
    points += 20;
    reasons.push("Reported roof area is promising.");
  } else reasons.push("Roof area needs survey confirmation.");
  if (!lead.tariff) {
    reasons.push("Tariff is missing; assessment needs review.");
  }
  const band = points >= 65 ? "HIGH" : points >= 35 ? "MEDIUM" : "LOW";
  return {
    points,
    band,
    reasons,
    nextAction:
      lead.ownerType === "TENANT" ||
      band === "LOW" ||
      (lead.monthlyUnits ?? 0) < 200 ||
      (lead.roofArea ?? 0) < 25
        ? "Short sales call"
        : "Book a roof survey",
    source: "baseline rules",
  };
}
export function shortCallExplanation(lead: {
  ownerType: string;
  monthlyUnits: number | null;
  roofArea: number | null;
}) {
  const reasons: string[] = [];
  if (lead.ownerType === "TENANT")
    reasons.push("the resident is not the property owner");
  if ((lead.monthlyUnits ?? 0) < 200)
    reasons.push("reported monthly electricity use is below 200 units");
  if ((lead.roofArea ?? 0) < 25)
    reasons.push("reported roof area still needs survey confirmation");
  return reasons.length
    ? `Short call recommended because ${reasons.join(" and ")}. This follow-up guardrail applies even when the score band is high.`
    : null;
}
export function recommend(units: number | null, roof: number | null) {
  if (!units)
    return { kw: null, note: "Confirm average monthly units before sizing." };
  let kw = Math.max(1, Math.round(((units * 12) / 1400) * 2) / 2);
  if (roof != null) {
    const max = Math.floor(roof / 10) / 2;
    if (max < kw)
      return {
        kw: Math.max(0.5, max),
        note: "Roof constraint flagged. Demo assumption: 10 m² per kW; confirm during survey.",
      };
  }
  return {
    kw,
    note: "Preliminary size from 1,400 units/kW/year. Survey may change it.",
  };
}
