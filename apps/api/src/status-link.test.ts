import { describe, expect, it } from "vitest";
import {
  createStatusToken,
  customerStatus,
  hashStatusToken,
  isActiveStatusToken,
} from "./status-link.js";

describe("customer status links", () => {
  it("creates high-entropy secrets and stores deterministic hashes", () => {
    const token = createStatusToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashStatusToken(token)).toHaveLength(64);
  });
  it("rejects expired and revoked links", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isActiveStatusToken({ expiresAt: future, revokedAt: null })).toBe(
      true,
    );
    expect(
      isActiveStatusToken({
        expiresAt: new Date(Date.now() - 1),
        revokedAt: null,
      }),
    ).toBe(false);
    expect(
      isActiveStatusToken({ expiresAt: future, revokedAt: new Date() }),
    ).toBe(false);
  });
  it("only maps customer-safe project status fields", () => {
    const project: any = {
      stage: "Installed",
      events: [{ stage: "Installed", createdAt: new Date("2026-01-01") }],
      documents: ["private"],
      consumerNumber: "001234",
      internalNotes: "do not expose",
    };
    expect(customerStatus(project)).toEqual({
      stage: "Installed",
      stageId: "INSTALLED",
      timeline: [
        {
          stage: "Installed",
          stageId: "INSTALLED",
          createdAt: new Date("2026-01-01"),
        },
      ],
    });
  });
});
