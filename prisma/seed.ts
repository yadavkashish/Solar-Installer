import "../apps/api/src/env.js";
import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";
import { recommend, score } from "../apps/api/src/engine.js";
const db = new PrismaClient();
async function main() {
  const passwordHash = await argon2.hash("DemoPass!2026");
  await db.user.upsert({
    where: { email: "sales@surya.demo" },
    update: { passwordHash, name: "Demo Sales" },
    create: {
      email: "sales@surya.demo",
      name: "Demo Sales",
      role: Role.SALES,
      passwordHash,
    },
  });
  const homeowner = await db.user.upsert({
    where: { email: "prashant@surya.demo" },
    update: { passwordHash, name: "Demo Homeowner" },
    create: {
      email: "prashant@surya.demo",
      name: "Demo Homeowner",
      role: Role.HOMEOWNER,
      passwordHash,
    },
  });
  for (const rule of [
    {
      category: "PRICE",
      payload: { pricePerKw: 65000 },
      version: "price-2026.1",
    },
    {
      category: "GENERATION",
      payload: { generationPerKw: 1400, selfUse: 0.8, rate: 8 },
      version: "generation-2026.1",
    },
    {
      category: "SUBSIDY",
      payload: { firstTwoPerKw: 30000, thirdKw: 18000, cap: 78000 },
      version: "subsidy-2026.1",
    },
  ])
    await db.ruleSet.upsert({
      where: { id: rule.category + "-2026" },
      update: { payload: rule.payload, version: rule.version },
      create: {
        id: rule.category + "-2026",
        category: rule.category,
        effectiveFrom: new Date("2026-01-01"),
        payload: rule.payload,
        version: rule.version,
      },
    });
  const sampleLeads = [
    ["LD-30881", "Prashant Wankhede", 3200, 340, "OWNER", "440001", "Owner with a typical residential bill"],
    ["LD-30902", "Rohit Meshram", 1900, 210, "TENANT", "440010", "Tenant: short sales call before survey"],
    ["LD-30915", "Ayesha Siddiqui", 650, 85, "OWNER", "440022", "Low consumption: savings discussion"],
    ["LD-30921", "Demo Commercial", 5200, 560, "OWNER", "440008", "Commercial tariff: subsidy review"],
    ["LD-30924", "Pending Confirmation", 2500, null, "OWNER", "440014", "Bill values need confirmation"],
    ["LD-30931", "Roof constrained", 4200, 420, "OWNER", "440030", "Reported roof area constrains preliminary size"],
  ] as const;
  for (const [id, name, bill, units, ownerType, pincode, sampleScenario] of sampleLeads) {
    const baseline = score({
      ownerType,
      monthlyUnits: units,
      roofArea: id === "LD-30931" ? 18 : 40,
      tariff: id === "LD-30921" ? "Commercial" : "Residential",
    });
    const roofArea = id === "LD-30931" ? 18 : 40;
    const recommendation = recommend(units, roofArea);
    const existing = await db.lead.findUnique({ where: { id } });
    if (existing) {
      // Mark stable, brief-provided fixtures without replacing a confirmed
      // customer bill or assessment that someone has already reviewed.
      await db.lead.update({
        where: { id },
        // These fixed IDs are the brief fixtures; this restores their names
        // while deliberately leaving confirmed bill values untouched.
        data: { name, isSample: true, sampleScenario },
      });
      if (existing.billStatus !== "CONFIRMED") {
        await db.lead.update({
          where: { id },
          data: {
            name,
            monthlyBill: bill,
            monthlyUnits: units,
            ownerType,
            pincode,
            roofArea,
            tariff: id === "LD-30921" ? "Commercial" : "Residential",
            assessment: {
              upsert: {
                create: {
                  source: baseline.source,
                  score: baseline.points,
                  band: baseline.band,
                  reasons: baseline.reasons,
                  nextAction: baseline.nextAction,
                  recommendation,
                },
                update: {
                  source: baseline.source,
                  score: baseline.points,
                  band: baseline.band,
                  reasons: baseline.reasons,
                  nextAction: baseline.nextAction,
                  recommendation,
                },
              },
            },
          },
        });
      }
      continue;
    }
    await db.lead.create({
      data: {
        id,
        name,
        email: id.toLowerCase() + "@surya.demo",
        phone: "9000000000",
        ownerType,
        pincode,
        roofType: "RCC",
        roofArea,
        monthlyBill: bill,
        monthlyUnits: units,
        tariff: id === "LD-30921" ? "Commercial" : "Residential",
        ownerId: homeowner.id,
        isSample: true,
        sampleScenario,
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
    });
  }
  console.log("Seeded demo accounts.");
}
main().finally(() => db.$disconnect());
