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
  for (const [id, name, bill, units, ownerType, pincode] of [
    ["LD-30881", "Demo Owner One", 3200, 340, "OWNER", "440001"],
    ["LD-30902", "Demo Tenant One", 1900, 210, "TENANT", "440010"],
    ["LD-30915", "Demo Owner Two", 650, 85, "OWNER", "440022"],
  ] as const) {
    const baseline = score({
      ownerType,
      monthlyUnits: units,
      roofArea: 40,
      tariff: "Residential",
    });
    const recommendation = recommend(units, 40);
    await db.lead.upsert({
      where: { id },
      update: {
        name,
        monthlyBill: bill,
        monthlyUnits: units,
        ownerType,
        pincode,
        assessment: {
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
      create: {
        id,
        name,
        email: id.toLowerCase() + "@surya.demo",
        phone: "9000000000",
        ownerType,
        pincode,
        roofType: "RCC",
        roofArea: 40,
        monthlyBill: bill,
        monthlyUnits: units,
        tariff: "Residential",
        ownerId: homeowner.id,
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
