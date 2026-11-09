import { describe, expect, it } from "vitest";
import {
  normaliseProviderExtraction,
  validatedProviderExtraction,
} from "./groq-contract.js";

const valid = {
  consumerNumber: "001234567890",
  tariff: "LT-I Residential",
  sanctionedLoad: 3,
  sanctionedLoadUnit: "kW",
  monthlyUnits: 340,
  monthlyBill: 3200,
  billingPeriod: null,
  unreadable: false,
  notes: [],
};

describe("Groq bill response contract", () => {
  it("accepts a complete provider response without changing consumer-number text", () => {
    expect(validatedProviderExtraction(valid)).toMatchObject({
      consumerNumber: "001234567890",
    });
  });

  it("normalises a scalar note into a one-item note array", () => {
    expect(
      validatedProviderExtraction({
        ...valid,
        notes: "Units estimated from image",
      }).notes,
    ).toEqual(["Units estimated from image"]);
  });

  it("rejects an unreadable array instead of inventing a boolean", () => {
    expect(
      normaliseProviderExtraction({ ...valid, unreadable: [false] }).success,
    ).toBe(false);
  });

  it("throws a readable contract error when a repair candidate is still invalid", () => {
    expect(() =>
      validatedProviderExtraction({ ...valid, unreadable: ["false"] }),
    ).toThrow("AI response did not match the bill-review format");
  });
});
