-- Preserve existing customer-owned leads.  Sales-created lead provenance is
-- additive and intentionally never changes Lead.ownerId to a sales account.
CREATE TYPE "LeadSource" AS ENUM ('HOMEOWNER_SELF_SERVICE', 'SALES_CREATED');

ALTER TABLE "Lead"
  ADD COLUMN "creationSource" "LeadSource" NOT NULL DEFAULT 'HOMEOWNER_SELF_SERVICE',
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sampleScenario" TEXT;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
