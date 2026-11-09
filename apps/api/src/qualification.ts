import { z } from "zod";

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

const providerAssessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  nextAction: z.enum(["Book a roof survey", "Short sales call"]),
});

export type QualificationInput = {
  ownerType: string;
  roofType: string;
  roofArea: number | null;
  tariff: string | null;
  monthlyUnits: number | null;
  monthlyBill: number | null;
};

export type BaselineAssessment = {
  points: number;
  band: string;
  reasons: string[];
  nextAction: string;
};

const bandFor = (score: number) =>
  score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

export async function assessQualification(
  input: QualificationInput,
  baseline: BaselineAssessment,
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Error("GROQ_API_KEY is not configured.");
  const model = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return JSON only. Assess solar-lead readiness from non-identifying property and energy data. Never reject a lead or make eligibility, subsidy, savings, or pricing decisions.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Return score (0-100), 1-4 concise reasons, and nextAction.",
            allowedNextActions: ["Book a roof survey", "Short sales call"],
            data: input,
          }),
        },
      ],
    }),
  });
  if (!response.ok)
    throw Error(`Groq qualification unavailable (${response.status}).`);
  const body: any = await response.json();
  const content = body.choices?.[0]?.message?.content;
  let candidate: unknown;
  try {
    candidate = typeof content === "string" ? JSON.parse(content) : null;
  } catch {
    candidate = null;
  }
  const parsed = providerAssessmentSchema.safeParse(candidate);
  if (!parsed.success) throw Error("Groq qualification response was invalid.");

  const mustShortCall =
    input.ownerType === "TENANT" ||
    (input.monthlyUnits ?? 0) < 200 ||
    (input.roofArea ?? 0) < 25 ||
    baseline.nextAction === "Short sales call";
  const score = Math.min(100, Math.max(0, parsed.data.score));
  return {
    source: "groq-assisted; deterministic guardrails applied",
    model,
    score,
    band: bandFor(score),
    reasons: parsed.data.reasons,
    nextAction: mustShortCall ? "Short sales call" : parsed.data.nextAction,
    assessedAt: new Date(),
  };
}
