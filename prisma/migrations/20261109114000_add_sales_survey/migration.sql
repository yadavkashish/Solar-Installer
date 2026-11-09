-- A survey is separate from preliminary homeowner intake and is required for
-- a new post-survey quote. Existing quote snapshots are not modified.
CREATE TABLE "Survey" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "usableRoofArea" DECIMAL(65,30) NOT NULL,
  "findings" TEXT,
  "surveyedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Survey_leadId_key" ON "Survey"("leadId");
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
