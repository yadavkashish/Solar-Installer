-- Forward-only state used to make bill extraction compare-and-swap safe and
-- to let a sales-created homeowner set their own password once.
ALTER TABLE "BillDocument"
  ADD COLUMN "extractionAttempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extractionStartedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD COLUMN "activationTokenHash" TEXT,
  ADD COLUMN "activationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_activationTokenHash_key" ON "User"("activationTokenHash");
