-- CreateEnum
CREATE TYPE "VatCategory" AS ENUM ('G', 'S');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "mrcNumber" TEXT;

-- AlterTable
ALTER TABLE "ExpenseItem" ADD COLUMN     "purchaseTypeId" TEXT,
ADD COLUMN     "unitOfMeasureId" TEXT,
ADD COLUMN     "vatCategory" "VatCategory" NOT NULL DEFAULT 'G';

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitOfMeasure_organizationId_idx" ON "UnitOfMeasure"("organizationId");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_organizationId_isActive_idx" ON "UnitOfMeasure"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_name_key" ON "UnitOfMeasure"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PurchaseType_organizationId_idx" ON "PurchaseType"("organizationId");

-- CreateIndex
CREATE INDEX "PurchaseType_organizationId_isActive_idx" ON "PurchaseType"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseType_organizationId_name_key" ON "PurchaseType"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_purchaseTypeId_fkey" FOREIGN KEY ("purchaseTypeId") REFERENCES "PurchaseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseType" ADD CONSTRAINT "PurchaseType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
