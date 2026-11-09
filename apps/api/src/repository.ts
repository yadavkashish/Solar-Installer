import crypto from "node:crypto";
import "./env.js";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { calculate, recommend, score } from "./engine.js";
export const db = new PrismaClient();
export class RuleConfigurationError extends Error {}
const calculationSchema = z.object({
  capacityKw: z.number(),
  grossCost: z.number(),
  subsidy: z.number(),
  netCost: z.number(),
  yearlyGeneration: z.number(),
  yearlySavings: z.number(),
  paybackYears: z.number().nullable(),
  assumptions: z.object({
    pricePerKw: z.number(),
    generationPerKw: z.number(),
    selfUse: z.number(),
    rate: z.number(),
    firstTwoPerKw: z.number().optional(),
    thirdKw: z.number().optional(),
    cap: z.number().optional(),
    effectiveFrom: z.string(),
    version: z.string(),
    subsidyNote: z.string(),
  }),
});
const quoteSnapshotSchema = z.object({
  leadId: z.string(),
  ruleVersion: z.string(),
  issuedAt: z.string().optional(),
  ruleEffectiveDates: z.record(z.string()).optional(),
  calculation: calculationSchema,
});
const pricePayload = z.object({ pricePerKw: z.number().positive() });
const generationPayload = z.object({
  generationPerKw: z.number().positive(),
  selfUse: z.number().min(0).max(1),
  rate: z.number().nonnegative(),
});
const subsidyPayload = z.object({
  firstTwoPerKw: z.number().nonnegative(),
  thirdKw: z.number().nonnegative(),
  cap: z.number().nonnegative(),
});
export function validateRuleWindows(
  rules: { category: string; effectiveFrom: Date; effectiveTo: Date | null }[],
) {
  for (const category of new Set(rules.map((rule) => rule.category))) {
    const sorted = rules
      .filter((rule) => rule.category === category)
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1],
        current = sorted[index];
      if (!previous.effectiveTo || previous.effectiveTo > current.effectiveFrom)
        throw new RuleConfigurationError(
          `Overlapping ${category} rules are not permitted.`,
        );
    }
  }
}
export function selectEffectiveRule(
  category: string,
  rules: { effectiveFrom: Date; effectiveTo: Date | null }[],
  issuedAt: Date,
) {
  validateRuleWindows(rules.map((rule) => ({ ...rule, category })));
  const matches = rules.filter(
    (rule) =>
      rule.effectiveFrom <= issuedAt &&
      (!rule.effectiveTo || rule.effectiveTo > issuedAt),
  );
  if (matches.length !== 1)
    throw new RuleConfigurationError(
      matches.length
        ? `Overlapping effective ${category} rules.`
        : `No effective ${category} rule for the issue date.`,
    );
  return matches[0];
}
async function effectiveRules(tx: any, issuedAt: Date) {
  const categories = ["PRICE", "GENERATION", "SUBSIDY"];
  const selected: any = {};
  for (const category of categories) {
    selected[category] = selectEffectiveRule(
      category,
      await tx.ruleSet.findMany({ where: { category } }),
      issuedAt,
    );
  }
  const price = pricePayload.parse(selected.PRICE.payload),
    generation = generationPayload.parse(selected.GENERATION.payload),
    subsidyRule = subsidyPayload.parse(selected.SUBSIDY.payload);
  const effectiveFrom = [
    selected.PRICE,
    selected.GENERATION,
    selected.SUBSIDY,
  ].map((rule: any) => rule.effectiveFrom.toISOString().slice(0, 10));
  return {
    rules: {
      ...price,
      ...generation,
      ...subsidyRule,
      effectiveFrom: effectiveFrom.join(", "),
      version: [selected.PRICE, selected.GENERATION, selected.SUBSIDY]
        .map((rule: any) => rule.version)
        .join(" | "),
    },
    effectiveDates: {
      PRICE: effectiveFrom[0],
      GENERATION: effectiveFrom[1],
      SUBSIDY: effectiveFrom[2],
    },
  };
}
export type QuoteView = {
  id: string;
  version: number;
  createdAt: Date;
  leadId: string;
  ruleVersion: string;
  calculation: z.infer<typeof calculationSchema>;
};
export function quoteView(quote: any): QuoteView {
  const snapshot = quoteSnapshotSchema.parse(quote.snapshot);
  return {
    id: quote.id,
    version: quote.version,
    createdAt: quote.createdAt,
    leadId: quote.leadId,
    ruleVersion: snapshot.ruleVersion,
    calculation: snapshot.calculation,
  };
}
const includeLead = {
  assessment: true,
  quotes: { orderBy: { version: "desc" } as const, take: 1 },
  project: { include: { events: true } },
};
const asLead = (l: any) => ({
  ...l,
  roofArea: l.roofArea == null ? null : Number(l.roofArea),
  monthlyUnits: l.monthlyUnits == null ? null : Number(l.monthlyUnits),
  score: l.assessment
    ? {
        points: l.assessment.score,
        band: l.assessment.band,
        reasons: l.assessment.reasons,
        nextAction: l.assessment.nextAction,
        source: l.assessment.source,
      }
    : undefined,
  recommendation: l.assessment?.recommendation,
  quote: l.quotes?.[0] ? quoteView(l.quotes[0]) : undefined,
});
export async function listLeads() {
  return (
    await db.lead.findMany({
      include: includeLead,
      orderBy: { createdAt: "desc" },
    })
  ).map(asLead);
}
export async function findLead(id: string) {
  const l = await db.lead.findUnique({ where: { id }, include: includeLead });
  return l ? asLead(l) : null;
}
export async function createLead(data: any, ownerId: string) {
  const id = "LD-" + Math.floor(31000 + Math.random() * 800);
  const baseline = score(data);
  const recommendation = recommend(data.monthlyUnits, data.roofArea);
  const lead = await db.lead.create({
    data: {
      ...data,
      id,
      ownerId,
      assessment: {
        create: {
          source: baseline.source,
          score: baseline.points,
          band: baseline.band,
          reasons: baseline.reasons,
          nextAction: baseline.nextAction,
          recommendation,
        },
      },
    },
    include: includeLead,
  });
  return asLead(lead);
}
export async function persistQuote(leadId: string, kw: number) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const version = (await tx.quote.count({ where: { leadId } })) + 1;
    const issuedAt = new Date();
    const active = await effectiveRules(tx, issuedAt);
    const calculation = calculate(
      kw,
      lead.tariff?.toLowerCase().includes("residential") ?? false,
      active.rules,
    );
    const snapshot = {
      leadId,
      issuedAt: issuedAt.toISOString(),
      ruleVersion: active.rules.version,
      ruleEffectiveDates: active.effectiveDates,
      calculation,
    };
    const quote = await tx.quote.create({
      data: {
        id: "Q-" + crypto.randomUUID().slice(0, 8),
        leadId,
        version,
        snapshot,
      },
    });
    return quoteView(quote);
  });
}
export const stages = [
  "Advance recorded (demo)",
  "Site survey complete",
  "Installation scheduled",
  "Installed",
  "Net-metering submitted",
  "Commissioned",
  "Subsidy credited",
];
export async function persistStage(
  leadId: string,
  next: string,
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    let p = await tx.project.findUnique({
      where: { leadId },
      include: { events: true },
    });
    if (!p)
      p = await tx.project.create({
        data: { leadId, stage: "NOT_STARTED" },
        include: { events: true },
      });
    const ci = p.stage === "NOT_STARTED" ? -1 : stages.indexOf(p.stage);
    if (stages.indexOf(next) !== ci + 1)
      throw Error("Invalid stage transition.");
    await tx.stageEvent.create({
      data: { projectId: p.id, stage: next, actorId },
    });
    await tx.notificationEvent.create({
      data: {
        projectId: p.id,
        type: "MOCK_STAGE_NOTIFICATION",
        payload: { stage: next },
      },
    });
    await tx.auditEvent.create({
      data: {
        leadId,
        actorId,
        action: "PROJECT_STAGE_CHANGED",
        metadata: { stage: next },
      },
    });
    return tx.project.update({
      where: { id: p.id },
      data: { stage: next },
      include: { events: true },
    });
  });
}
