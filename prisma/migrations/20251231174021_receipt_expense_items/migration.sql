/*
  Warnings:

  - You are about to drop the column `amount` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `policyViolation` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Expense` table. All the data in the column will be lost.
  - Added the required column `companyName` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdByUserId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fsNumber` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMethod` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purchasedDate` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tinNumber` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vat` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CREDIT_CARD', 'BANK_TRANSFER', 'OTHER');

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_userId_fkey";

-- DropIndex
DROP INDEX "Expense_categoryId_idx";

-- DropIndex
DROP INDEX "Expense_userId_idx";

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN     "purchasedDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN     "companyName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tinNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fsNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vat" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdByUserId" TEXT;

-- Backfill from legacy columns before dropping them
UPDATE "Expense"
SET
  "createdByUserId" = "userId",
  "purchasedDate" = COALESCE("purchasedDate", "createdAt"),
  "subtotal" = COALESCE("subtotal", 0) + COALESCE("amount", 0),
  "vat" = COALESCE("vat", 0),
  "total" = COALESCE("total", 0) + COALESCE("amount", 0)
WHERE "createdByUserId" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- Now drop legacy columns
ALTER TABLE "Expense"
DROP COLUMN "amount",
DROP COLUMN "categoryId",
DROP COLUMN "currency",
DROP COLUMN "description",
DROP COLUMN "policyViolation",
DROP COLUMN "priority",
DROP COLUMN "userId";

-- DropEnum
DROP TYPE "ExpensePriority";

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "hasPolicyViolation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseItem_expenseId_idx" ON "ExpenseItem"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseItem_subcategoryId_idx" ON "ExpenseItem"("subcategoryId");

-- CreateIndex
CREATE INDEX "Expense_createdByUserId_idx" ON "Expense"("createdByUserId");

-- CreateIndex
CREATE INDEX "Expense_purchasedDate_idx" ON "Expense"("purchasedDate");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
