import { describe, expect, it } from "vitest";
import { canSignIn, requiresActivation } from "./account-activation.js";

describe("provisioned homeowner activation", () => {
  it("blocks password sign-in while an activation token is pending", () => {
    const pending = { activationTokenHash: "pending-hash", activatedAt: null };
    expect(requiresActivation(pending)).toBe(true);
    expect(canSignIn(pending)).toBe(false);
    expect(requiresActivation(null)).toBe(true);
  });

  it("allows activated accounts and existing accounts without an activation token", () => {
    expect(
      canSignIn({
        activationTokenHash: null,
        activatedAt: null,
      }),
    ).toBe(true);
    expect(
      canSignIn({
        activationTokenHash: "used-hash",
        activatedAt: new Date(),
      }),
    ).toBe(true);
  });
});
