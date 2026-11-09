import { describe, expect, it } from "vitest";
import { assessmentView } from "./repository.js";

describe("assessment provenance view", () => {
  it("preserves the saved fallback source, absent model, and assessment time", () => {
    const assessedAt = new Date("2026-11-09T10:30:00.000Z");
    expect(
      assessmentView({
        score: 65,
        band: "HIGH",
        reasons: ["Baseline input"],
        nextAction: "Book a roof survey",
        source: "baseline fallback; Groq qualification unavailable",
        model: null,
        assessedAt,
      }),
    ).toMatchObject({
      source: "baseline fallback; Groq qualification unavailable",
      model: null,
      assessedAt,
    });
  });

  it("preserves the provider model for an AI-assisted saved assessment", () => {
    expect(
      assessmentView({
        score: 70,
        band: "HIGH",
        reasons: [],
        nextAction: "Book a roof survey",
        source: "groq-assisted; deterministic guardrails applied",
        model: "vision-model",
        assessedAt: new Date(),
      }),
    ).toMatchObject({ model: "vision-model" });
  });
});
