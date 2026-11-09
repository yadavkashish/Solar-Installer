import { z } from "zod";

const nullableText = z.string().trim().min(1).nullable();
const nullableNumber = z.number().finite().nonnegative().nullable();
const requiredNumber = (message: string, positive = false) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    positive
      ? z.coerce.number().finite().positive(message)
      : z.coerce.number().finite().nonnegative(message),
  );

/**
 * Canonical shape persisted in BillDocument.extraction and BillDocument.confirmed.
 * `monthlyBill` is deliberately used everywhere; older records may contain the
 * previous `billAmount` key and are normalised on read.
 */
export const billExtractionSchema = z.object({
  consumerNumber: nullableText,
  tariff: nullableText,
  sanctionedLoad: nullableNumber,
  sanctionedLoadUnit: z.enum(["kW", "kVA"]).nullable(),
  monthlyUnits: nullableNumber,
  monthlyBill: nullableNumber,
  billingPeriod: nullableText,
  unreadable: z.boolean(),
  notes: z.array(z.string()),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;

export const extractionStatus = (extraction: BillExtraction) =>
  extraction.unreadable ? "MANUAL_REQUIRED" : "EXTRACTED";

/** Qualification and quoting may only use a complete, human-reviewed bill. */
export const billConfirmationSchema = z.object({
  consumerNumber: z.string().trim().min(1, "Consumer number is required."),
  tariff: z.string().trim().min(1, "Tariff is required."),
  sanctionedLoad: requiredNumber(
    "Sanctioned load must be greater than zero.",
    true,
  ),
  sanctionedLoadUnit: z.enum(["kW", "kVA"]),
  monthlyUnits: requiredNumber(
    "Monthly units must be greater than zero.",
    true,
  ),
  monthlyBill: requiredNumber("Monthly bill cannot be negative."),
});

export type BillConfirmation = z.infer<typeof billConfirmationSchema>;

/** Read both the canonical shape and records written by the earlier billAmount API. */
export function normaliseBillExtraction(value: unknown): BillExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const legacy = value as Record<string, unknown>;
  return (
    billExtractionSchema.safeParse({
      consumerNumber: legacy.consumerNumber ?? null,
      tariff: legacy.tariff ?? null,
      sanctionedLoad: legacy.sanctionedLoad ?? null,
      sanctionedLoadUnit: legacy.sanctionedLoadUnit ?? null,
      monthlyUnits: legacy.monthlyUnits ?? null,
      monthlyBill: legacy.monthlyBill ?? legacy.billAmount ?? null,
      billingPeriod: legacy.billingPeriod ?? null,
      unreadable: legacy.unreadable ?? false,
      notes: legacy.notes ?? [],
    }).data ?? null
  );
}

export function normaliseBillConfirmation(
  value: unknown,
): BillConfirmation | null {
  return billConfirmationSchema.safeParse(value).data ?? null;
}
