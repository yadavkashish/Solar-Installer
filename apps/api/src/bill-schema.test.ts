import { describe, expect, it } from "vitest";
import {
  billConfirmationSchema,
  billExtractionSchema,
  extractionStatus,
  normaliseBillExtraction,
} from "./bill-schema.js";

describe("bill confirmation validation", () => {
  it("rejects a blank review so it cannot be marked CONFIRMED", () => {
    expect(
      billConfirmationSchema.safeParse({
        consumerNumber: null,
        tariff: null,
        sanctionedLoad: null,
        sanctionedLoadUnit: null,
        monthlyUnits: null,
        monthlyBill: null,
      }).success,
    ).toBe(false);
  });

  it("does not coerce an empty monthly bill into zero", () => {
    expect(
      billConfirmationSchema.safeParse({
        consumerNumber: "001234567890",
        tariff: "LT-I Residential",
        sanctionedLoad: "3",
        sanctionedLoadUnit: "kW",
        monthlyUnits: "340",
        monthlyBill: "",
      }).success,
    ).toBe(false);
  });

  it("normalises the legacy extraction billAmount key on read", () => {
    expect(
      normaliseBillExtraction({
        billAmount: 3200,
        unreadable: false,
        notes: [],
      }),
    ).toMatchObject({ monthlyBill: 3200 });
  });

  it("requires manual review when a provider marks a bill unreadable", () => {
    const extraction = billExtractionSchema.parse({
      consumerNumber: null,
      tariff: null,
      sanctionedLoad: null,
      sanctionedLoadUnit: null,
      monthlyUnits: null,
      monthlyBill: null,
      billingPeriod: null,
      unreadable: true,
      notes: ["Image is blurry"],
    });
    expect(extractionStatus(extraction)).toBe("MANUAL_REQUIRED");
  });
});
