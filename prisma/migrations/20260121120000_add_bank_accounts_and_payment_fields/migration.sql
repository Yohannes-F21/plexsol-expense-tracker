-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "checkNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN "bankAccountId" TEXT;

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_organizationId_idx" ON "BankAccount"("organizationId");

-- CreateIndex
CREATE INDEX "BankAccount_organizationId_isActive_idx" ON "BankAccount"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_organizationId_code_key" ON "BankAccount"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Expense_bankAccountId_idx" ON "Expense"("bankAccountId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
