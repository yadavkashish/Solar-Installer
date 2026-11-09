import crypto from "node:crypto";
import "./env.js";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { z } from "zod";
import { calculate, recommend, score, sizing } from "./engine.js";
import {
  normaliseStageId,
  PROJECT_STAGES,
  projectWorkflow,
  stageTransitionDecision,
  type ProjectStageId,
} from "./project-stages.js";
export const db = new PrismaClient();
export class RuleConfigurationError extends Error {}
export class LeadOwnershipError extends Error {}
export class SurveyRequiredError extends Error {}
export class SurveyCapacityError extends Error {}
export class ProjectTransitionError extends Error {
  constructor(
    message: string,
    readonly workflow: ReturnType<typeof projectWorkflow>,
    readonly stale = false,
  ) {
    super(message);
  }
}
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
  survey: z
    .object({
      usableRoofArea: z.number(),
      consumptionBasedKw: z.number().nullable(),
      roofLimitedKw: z.number().nullable(),
      recommendedKw: z.number().nullable(),
    })
    .optional(),
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
  survey?: {
    usableRoofArea: number;
    consumptionBasedKw: number | null;
    roofLimitedKw: number | null;
    recommendedKw: number | null;
  };
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
    survey: snapshot.survey,
  };
}
const includeLead = {
  assessment: true,
  quotes: { orderBy: { version: "desc" } as const, take: 1 },
  project: { include: { events: true } },
  survey: true,
  createdBy: { select: { id: true, name: true } },
};
export function assessmentView(assessment: any) {
  if (!assessment) return undefined;
  return {
    points: assessment.score,
    band: assessment.band,
    reasons: assessment.reasons,
    nextAction: assessment.nextAction,
    source: assessment.source,
    model: assessment.model,
    assessedAt: assessment.assessedAt,
  };
}
const asLead = (l: any) => ({
  ...l,
  roofArea: l.roofArea == null ? null : Number(l.roofArea),
  monthlyUnits: l.monthlyUnits == null ? null : Number(l.monthlyUnits),
  survey: l.survey
    ? { ...l.survey, usableRoofArea: Number(l.survey.usableRoofArea) }
    : null,
  score: assessmentView(l.assessment),
  recommendation: l.assessment?.recommendation,
  preliminarySizing: sizing(
    l.monthlyUnits == null ? null : Number(l.monthlyUnits),
    l.roofArea == null ? null : Number(l.roofArea),
  ),
  surveyedSizing: l.survey
    ? sizing(
        l.monthlyUnits == null ? null : Number(l.monthlyUnits),
        Number(l.survey.usableRoofArea),
      )
    : null,
  quote: l.quotes?.[0] ? quoteView(l.quotes[0]) : undefined,
  project: l.project
    ? {
        ...l.project,
        stage: normaliseStageId(l.project.stage),
        events: l.project.events.map((event: any) => ({
          ...event,
          stage: normaliseStageId(event.stage),
        })),
      }
    : null,
  projectWorkflow: projectWorkflow({
    currentStageId: l.project?.stage,
    hasQuote: Boolean(l.quotes?.[0]),
    hasSurvey: Boolean(l.survey),
  }),
  createdBy: l.createdBy ?? null,
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
      creationSource: "HOMEOWNER_SELF_SERVICE",
      assessment: {
        create: {
          source: baseline.source,
          score: baseline.points,
          band: baseline.band,
          reasons: baseline.reasons,
          nextAction: baseline.nextAction,
          recommendation,
          assessedAt: new Date(),
        },
      },
    },
    include: includeLead,
  });
  return asLead(lead);
}
/**
 * Sales may record an intake on a customer's behalf.  The lead always belongs
 * to a HOMEOWNER record (an existing one by email, or a provisioned customer
 * record) and separately records the staff member who created it.
 */
export async function createSalesLead(data: any, salesUserId: string) {
  const baseline = score(data);
  const recommendation = recommend(data.monthlyUnits, data.roofArea);
  const id = "LD-" + Math.floor(31000 + Math.random() * 800);
  const provisionalPasswordHash = await argon2.hash(
    crypto.randomBytes(32).toString("base64url"),
  );
  const lead = await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: data.email } });
    if (existing && existing.role !== "HOMEOWNER")
      throw new LeadOwnershipError(
        "A sales account cannot be used as the homeowner for a customer lead.",
      );
    const homeowner =
      existing ??
      (await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: "HOMEOWNER",
          // This is a non-disclosed, random placeholder: it cannot be used as
          // a staff password or exposed through the API.
          passwordHash: provisionalPasswordHash,
        },
      }));
    return tx.lead.create({
      data: {
        ...data,
        id,
        ownerId: homeowner.id,
        createdById: salesUserId,
        creationSource: "SALES_CREATED",
        assessment: {
          create: {
            source: baseline.source,
            score: baseline.points,
            band: baseline.band,
            reasons: baseline.reasons,
            nextAction: baseline.nextAction,
            recommendation,
            assessedAt: new Date(),
          },
        },
        audits: {
          create: {
            actorId: salesUserId,
            action: "SALES_LEAD_CREATED",
            metadata: { ownerId: homeowner.id },
          },
        },
      },
      include: includeLead,
    });
  });
  return asLead(lead);
}
export async function persistQuote(leadId: string, kw: number) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { survey: true },
    });
    if (!lead.survey)
      throw new SurveyRequiredError(
        "Record usable roof area in the sales survey before issuing a post-survey quote.",
      );
    const surveySizing = sizing(
      lead.monthlyUnits == null ? null : Number(lead.monthlyUnits),
      Number(lead.survey.usableRoofArea),
    );
    if (surveySizing.roofLimitedKw != null && kw > surveySizing.roofLimitedKw)
      throw new SurveyCapacityError(
        `Quote capacity exceeds the surveyed roof limit of ${surveySizing.roofLimitedKw} kW.`,
      );
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
      survey: {
        usableRoofArea: Number(lead.survey.usableRoofArea),
        ...surveySizing,
      },
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
export async function persistStage(
  leadId: string,
  next: ProjectStageId,
  actorId: string,
  expectedStageId: ProjectStageId | null,
) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { survey: true, quotes: { take: 1 } },
    });
    if (!lead) throw Object.assign(new Error("Lead not found"), { code: "P2025" });
    let p = await tx.project.findUnique({
      where: { leadId },
      include: { events: true },
    });
    const currentStageId = normaliseStageId(p?.stage);
    const decision = stageTransitionDecision({
      currentStageId,
      expectedStageId,
      nextStageId: next,
      hasQuote: lead.quotes.length > 0,
      hasSurvey: Boolean(lead.survey),
    });
    if (!decision.ok)
      throw new ProjectTransitionError(
        decision.message,
        decision.workflow,
        decision.stale,
      );
    if (!p)
      p = await tx.project.upsert({
        where: { leadId },
        create: { leadId, stage: "NOT_STARTED" },
        update: {},
        include: { events: true },
      });
    const storedCurrent = p.stage;
    const advanced = await tx.project.updateMany({
      where: { id: p.id, stage: storedCurrent },
      data: { stage: next },
    });
    if (advanced.count !== 1)
      throw new ProjectTransitionError(
        "Project stage changed elsewhere. Refresh and try the currently allowed action.",
        decision.workflow,
        true,
      );
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
      data: {},
      include: { events: true },
    });
  });
}
