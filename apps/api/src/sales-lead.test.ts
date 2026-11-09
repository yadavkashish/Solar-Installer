import { describe, expect, it } from "vitest";
import { requiresActivation } from "./account-activation.js";

describe("sales-created homeowner access", () => {
  it("requires a one-time activation for a newly provisioned homeowner", () => {
    expect(requiresActivation(null)).toBe(true);
    expect(
      requiresActivation({
        activationTokenHash: "pending-hash",
        activatedAt: null,
      }),
    ).toBe(true);
  });

  it("preserves access for an existing homeowner or an activated account", () => {
    expect(
      requiresActivation({
        activationTokenHash: null,
        activatedAt: null,
      }),
    ).toBe(false);
    expect(
      requiresActivation({
        activationTokenHash: "used-hash",
        activatedAt: new Date(),
      }),
    ).toBe(false);
  });
});
