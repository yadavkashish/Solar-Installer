-- Nullable preserves existing leads without fabricating a pincode.
ALTER TABLE "Lead" ADD COLUMN "pincode" TEXT;
ALTER TABLE "QualificationAssessment" ADD COLUMN "model" TEXT;
ALTER TABLE "QualificationAssessment" ADD COLUMN "assessedAt" TIMESTAMP(3);
