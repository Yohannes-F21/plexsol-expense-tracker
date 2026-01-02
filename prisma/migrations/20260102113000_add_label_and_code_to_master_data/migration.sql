-- AlterTable
ALTER TABLE "UnitOfMeasure" ADD COLUMN "label" INTEGER;
UPDATE "UnitOfMeasure" SET "label" = 1 WHERE "label" IS NULL;
ALTER TABLE "UnitOfMeasure" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "UnitOfMeasure" RENAME COLUMN "name" TO "code";

-- Recreate unique index for renamed column
DROP INDEX IF EXISTS "UnitOfMeasure_organizationId_name_key";
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_code_key" ON "UnitOfMeasure"("organizationId", "code");

-- AlterTable
ALTER TABLE "PurchaseType" ADD COLUMN "label" INTEGER;
UPDATE "PurchaseType" SET "label" = 1 WHERE "label" IS NULL;
ALTER TABLE "PurchaseType" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "PurchaseType" RENAME COLUMN "name" TO "code";

-- Recreate unique index for renamed column
DROP INDEX IF EXISTS "PurchaseType_organizationId_name_key";
CREATE UNIQUE INDEX "PurchaseType_organizationId_code_key" ON "PurchaseType"("organizationId", "code");
