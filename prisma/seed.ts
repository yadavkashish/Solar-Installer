import "../apps/api/src/env.js";
import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";
import {
  demoHomeownerEmail,
  demoLeads,
  demoPassword,
  demoRules,
  demoSalesEmail,
  canSeedDatabase,
  sampleAssessment,
  sampleQuoteSnapshot,
  sampleStatusToken,
  sampleStatusTokenHash,
} from "./seed-data.js";
import { calculate, DEMO_RULES } from "../apps/api/src/engine.js";
import { hashStatusToken } from "../apps/api/src/status-link.js";

const db = new PrismaClient();
const seededAt = new Date("2026-01-01T00:00:00.000Z");
const demoProjectStatusId = "DEMO-STATUS-LD-30881";
const normalizedDemoStatusHash = hashStatusToken(sampleStatusToken);
if (normalizedDemoStatusHash !== sampleStatusTokenHash)
  throw new Error("Synthetic customer status token hash mismatch.");

async function main() {
  if (!canSeedDatabase(process.env.DATABASE_URL, process.env.ALLOW_REMOTE_SEED)) {
    throw new Error(
      "Refusing to seed a non-local database. Use a localhost DATABASE_URL or explicitly set ALLOW_REMOTE_SEED=true for this one invocation.",
    );
  }

  const existingSales = await db.user.findUnique({
    where: { email: demoSalesEmail },
  });
  if (existingSales && existingSales.role !== Role.SALES)
    throw new Error(`Refusing to overwrite account ${demoSalesEmail}.`);
  const existingHomeowner = await db.user.findUnique({
    where: { email: demoHomeownerEmail },
  });
  if (existingHomeowner && existingHomeowner.role !== Role.HOMEOWNER)
    throw new Error(`Refusing to overwrite account ${demoHomeownerEmail}.`);

  const passwordHash = await argon2.hash(demoPassword);
  const sales = await db.user.upsert({
    where: { email: demoSalesEmail },
    update: {
      name: "Synthetic Demo Sales",
      passwordHash,
      role: Role.SALES,
      activationTokenHash: null,
      activationExpiresAt: null,
      activatedAt: seededAt,
    },
    create: {
      email: demoSalesEmail,
      name: "Synthetic Demo Sales",
      role: Role.SALES,
      passwordHash,
      activatedAt: seededAt,
    },
  });
  const homeowner = await db.user.upsert({
    where: { email: demoHomeownerEmail },
    update: {
      name: "Synthetic Demo Homeowner",
      passwordHash,
      role: Role.HOMEOWNER,
      activationTokenHash: null,
      activationExpiresAt: null,
      activatedAt: seededAt,
    },
    create: {
      email: demoHomeownerEmail,
      name: "Synthetic Demo Homeowner",
      role: Role.HOMEOWNER,
      passwordHash,
      activatedAt: seededAt,
    },
  });

  for (const rule of demoRules) {
    await db.ruleSet.upsert({
      where: { id: rule.id },
      update: {
        category: rule.category,
        effectiveFrom: seededAt,
        effectiveTo: null,
        payload: rule.payload,
        version: rule.version,
      },
      create: {
        id: rule.id,
        category: rule.category,
        effectiveFrom: seededAt,
        payload: rule.payload,
        version: rule.version,
      },
    });
  }

  for (const lead of demoLeads) {
    const existing = await db.lead.findUnique({ where: { id: lead.id } });
    if (existing && !existing.isSample)
      throw new Error(
        `Refusing to overwrite non-synthetic record ${lead.id}.`,
      );
    const { baseline, recommendation } = sampleAssessment(lead);
    const assessment = {
      source: baseline.source,
      score: baseline.points,
      band: baseline.band,
      reasons: baseline.reasons,
      nextAction: baseline.nextAction,
      recommendation,
      assessedAt: seededAt,
    };
    const values = {
      ...lead,
      phone: "0000000000",
      roofType: "RCC",
      tariff: "Residential",
      billStatus: "NEEDS_REVIEW",
      ownerId: homeowner.id,
      isSample: true,
    };
    if (!existing) {
      await db.lead.create({
        data: {
          ...values,
          assessment: { create: assessment },
        },
      });
    } else if (existing.billStatus !== "CONFIRMED") {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          ...values,
          assessment: {
            upsert: {
              create: assessment,
              update: assessment,
            },
          },
        },
      });
    }
  }

  const lead = await db.lead.findUniqueOrThrow({
    where: { id: "LD-30881" },
  });
  let survey = await db.survey.findUnique({ where: { leadId: lead.id } });
  if (!survey) {
    survey = await db.survey.create({
      data: {
        leadId: lead.id,
        usableRoofArea: 40,
        findings: "Synthetic demo survey; not a structural assessment.",
        surveyedById: sales.id,
      },
    });
  }
  const snapshot = sampleQuoteSnapshot();
  const existingQuote = await db.quote.findUnique({
    where: { leadId_version: { leadId: lead.id, version: 1 } },
  });
  if (!existingQuote)
    await db.quote.create({
      data: {
        id: "Q-DEMO-30881",
        leadId: lead.id,
        version: 1,
        snapshot,
        createdAt: seededAt,
      },
    });

  const project = await db.project.upsert({
    where: { leadId: lead.id },
    update: {},
    create: { leadId: lead.id, stage: "INSTALLATION_SCHEDULED" },
  });
  for (const stage of ["SITE_SURVEY_COMPLETE", "INSTALLATION_SCHEDULED"]) {
    const event = await db.stageEvent.findFirst({
      where: { projectId: project.id, stage },
    });
    if (!event)
      await db.stageEvent.create({
        data: { projectId: project.id, stage, actorId: sales.id, createdAt: seededAt },
      });
    const notification = await db.notificationEvent.findFirst({
      where: { projectId: project.id, type: `DEMO_${stage}` },
    });
    if (!notification)
      await db.notificationEvent.create({
        data: {
          projectId: project.id,
          type: `DEMO_${stage}`,
          payload: { channel: "mock WhatsApp/SMS", stage, synthetic: true },
          createdAt: seededAt,
        },
      });
  }
  await db.statusToken.upsert({
    where: { id: demoProjectStatusId },
    update: {
      projectId: project.id,
      tokenHash: hashStatusToken(sampleStatusToken),
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      revokedAt: null,
    },
    create: {
      id: demoProjectStatusId,
      projectId: project.id,
      tokenHash: hashStatusToken(sampleStatusToken),
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  });

  const summary = demoLeads.map((sample) => {
    const { baseline, recommendation } = sampleAssessment(sample);
    return `${sample.id}: ${baseline.band}, ${recommendation.kw ?? "no"} kW`;
  });
  console.log("Seeded three synthetic brief leads, dated demo rules and tracker.");
  console.log(`Demo sales: ${demoSalesEmail}; demo homeowner: ${demoHomeownerEmail}`);
  console.log(`Demo password: ${demoPassword}`);
  console.log(`Customer status: /customer-status/${sampleStatusToken}`);
  console.log(summary.join("\n"));
  console.log(
    `Sample quote: ${calculate(3, true, DEMO_RULES).netCost} INR net (synthetic).`,
  );
  console.log(`Sample survey area: ${Number(survey.usableRoofArea)} m².`);
}

main()
  .catch((error) => {
    console.error("Synthetic local seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
