/*
  Warnings:

  - You are about to drop the `Approval` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_expenseId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "Approval";

-- DropEnum
DROP TYPE "ApprovalStatus";

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comment" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalHistory_expenseId_idx" ON "ApprovalHistory"("expenseId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_performedById_idx" ON "ApprovalHistory"("performedById");

-- CreateIndex
CREATE INDEX "ApprovalHistory_createdAt_idx" ON "ApprovalHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
