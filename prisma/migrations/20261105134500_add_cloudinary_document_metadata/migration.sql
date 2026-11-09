-- Forward repair for the previously recorded empty migration.
-- BillDocument contained no rows when this migration was authored.
ALTER TABLE "BillDocument"
  ADD COLUMN "publicId" TEXT NOT NULL,
  ADD COLUMN "resourceType" TEXT NOT NULL,
  ADD COLUMN "deliveryType" TEXT NOT NULL,
  ADD COLUMN "format" TEXT NOT NULL;

CREATE UNIQUE INDEX "BillDocument_publicId_key" ON "BillDocument"("publicId");
