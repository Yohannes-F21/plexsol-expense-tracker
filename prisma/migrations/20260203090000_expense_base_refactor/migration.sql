-- Expense type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseType') THEN
    CREATE TYPE "ExpenseType" AS ENUM ('RECEIPT', 'PAYMENT_VOUCHER', 'GENERAL');
  END IF;
END $$;

-- Extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Base expense table
CREATE TABLE IF NOT EXISTS "ExpenseBase" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "expenseType" "ExpenseType" NOT NULL,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseBase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExpenseBase_organizationId_idx" ON "ExpenseBase"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpenseBase_createdByUserId_idx" ON "ExpenseBase"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ExpenseBase_expenseType_idx" ON "ExpenseBase"("expenseType");
CREATE INDEX IF NOT EXISTS "ExpenseBase_status_idx" ON "ExpenseBase"("status");
CREATE INDEX IF NOT EXISTS "ExpenseBase_createdAt_idx" ON "ExpenseBase"("createdAt");

ALTER TABLE "ExpenseBase"
  ADD CONSTRAINT "ExpenseBase_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseBase"
  ADD CONSTRAINT "ExpenseBase_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Receipt expenses
CREATE TABLE IF NOT EXISTS "ReceiptExpense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "expenseBaseId" TEXT NOT NULL,
  "purchasedDate" TIMESTAMP(3) NOT NULL,
  "companyName" TEXT NOT NULL,
  "tinNumber" TEXT,
  "fsNumber" TEXT,
  "mrcNumber" TEXT,
  "invoiceNumber" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "checkNumber" TEXT,
  "bankAccountId" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "vat" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "ReceiptExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReceiptExpense_expenseBaseId_key" ON "ReceiptExpense"("expenseBaseId");
CREATE INDEX IF NOT EXISTS "ReceiptExpense_expenseBaseId_idx" ON "ReceiptExpense"("expenseBaseId");
CREATE INDEX IF NOT EXISTS "ReceiptExpense_purchasedDate_idx" ON "ReceiptExpense"("purchasedDate");

ALTER TABLE "ReceiptExpense"
  ADD CONSTRAINT "ReceiptExpense_expenseBaseId_fkey"
  FOREIGN KEY ("expenseBaseId") REFERENCES "ExpenseBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReceiptExpense"
  ADD CONSTRAINT "ReceiptExpense_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReceiptExpenseItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "receiptExpenseId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "vatCategory" "VatCategory" NOT NULL DEFAULT 'G',
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "unitOfMeasureId" TEXT,
  "purchaseTypeId" TEXT,
  "hasPolicyViolation" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "ReceiptExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReceiptExpenseItem_receiptExpenseId_idx" ON "ReceiptExpenseItem"("receiptExpenseId");
CREATE INDEX IF NOT EXISTS "ReceiptExpenseItem_categoryId_idx" ON "ReceiptExpenseItem"("categoryId");

ALTER TABLE "ReceiptExpenseItem"
  ADD CONSTRAINT "ReceiptExpenseItem_receiptExpenseId_fkey"
  FOREIGN KEY ("receiptExpenseId") REFERENCES "ReceiptExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReceiptExpenseItem"
  ADD CONSTRAINT "ReceiptExpenseItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReceiptExpenseItem"
  ADD CONSTRAINT "ReceiptExpenseItem_unitOfMeasureId_fkey"
  FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceiptExpenseItem"
  ADD CONSTRAINT "ReceiptExpenseItem_purchaseTypeId_fkey"
  FOREIGN KEY ("purchaseTypeId") REFERENCES "PurchaseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment voucher expenses
CREATE TABLE IF NOT EXISTS "PaymentVoucherExpense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "expenseBaseId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "purchasedDate" TIMESTAMP(3) NOT NULL,
  "paidTo" TEXT NOT NULL,
  "tinNumber" TEXT,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  CONSTRAINT "PaymentVoucherExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentVoucherExpense_expenseBaseId_key" ON "PaymentVoucherExpense"("expenseBaseId");

ALTER TABLE "PaymentVoucherExpense"
  ADD CONSTRAINT "PaymentVoucherExpense_expenseBaseId_fkey"
  FOREIGN KEY ("expenseBaseId") REFERENCES "ExpenseBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PaymentVoucherItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "paymentVoucherId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "PaymentVoucherItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentVoucherItem"
  ADD CONSTRAINT "PaymentVoucherItem_paymentVoucherId_fkey"
  FOREIGN KEY ("paymentVoucherId") REFERENCES "PaymentVoucherExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentVoucherItem"
  ADD CONSTRAINT "PaymentVoucherItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- General expenses
CREATE TABLE IF NOT EXISTS "GeneralExpense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "expenseBaseId" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "paidTo" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "GeneralExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GeneralExpense_expenseBaseId_key" ON "GeneralExpense"("expenseBaseId");

ALTER TABLE "GeneralExpense"
  ADD CONSTRAINT "GeneralExpense_expenseBaseId_fkey"
  FOREIGN KEY ("expenseBaseId") REFERENCES "ExpenseBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneralExpense"
  ADD CONSTRAINT "GeneralExpense_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Approval history: add expenseBaseId
ALTER TABLE "ApprovalHistory" ADD COLUMN IF NOT EXISTS "expenseBaseId" TEXT;

-- Backfill mapping table
CREATE TABLE IF NOT EXISTS "_ExpenseBaseMap" (
  "expenseId" TEXT PRIMARY KEY,
  "expenseBaseId" TEXT NOT NULL UNIQUE,
  "receiptExpenseId" TEXT NOT NULL UNIQUE
);

INSERT INTO "_ExpenseBaseMap" ("expenseId", "expenseBaseId", "receiptExpenseId")
SELECT e.id, gen_random_uuid()::text, gen_random_uuid()::text
FROM "Expense" e
ON CONFLICT ("expenseId") DO NOTHING;

-- Backfill ExpenseBase
INSERT INTO "ExpenseBase" (
  "id",
  "organizationId",
  "createdByUserId",
  "expenseType",
  "status",
  "approvedAt",
  "rejectedAt",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  m."expenseBaseId",
  e."organizationId",
  e."createdByUserId",
  'RECEIPT',
  e."status",
  e."approvedAt",
  NULL,
  e."isActive",
  e."createdAt",
  e."updatedAt"
FROM "Expense" e
JOIN "_ExpenseBaseMap" m ON m."expenseId" = e."id"
ON CONFLICT ("id") DO NOTHING;

-- Backfill ReceiptExpense
INSERT INTO "ReceiptExpense" (
  "id",
  "expenseBaseId",
  "purchasedDate",
  "companyName",
  "tinNumber",
  "fsNumber",
  "mrcNumber",
  "invoiceNumber",
  "paymentMethod",
  "checkNumber",
  "bankAccountId",
  "subtotal",
  "vat",
  "total"
)
SELECT
  m."receiptExpenseId",
  m."expenseBaseId",
  e."purchasedDate",
  e."companyName",
  NULLIF(e."tinNumber", ''),
  NULLIF(e."fsNumber", ''),
  e."mrcNumber",
  e."invoiceNumber",
  e."paymentMethod",
  e."checkNumber",
  e."bankAccountId",
  e."subtotal",
  e."vat",
  e."total"
FROM "Expense" e
JOIN "_ExpenseBaseMap" m ON m."expenseId" = e."id"
ON CONFLICT ("expenseBaseId") DO NOTHING;

-- Backfill ReceiptExpenseItem from ExpenseItem
INSERT INTO "ReceiptExpenseItem" (
  "id",
  "receiptExpenseId",
  "itemName",
  "categoryId",
  "vatCategory",
  "quantity",
  "unitPrice",
  "lineTotal",
  "unitOfMeasureId",
  "purchaseTypeId",
  "hasPolicyViolation"
)
SELECT
  gen_random_uuid()::text,
  m."receiptExpenseId",
  ei."itemName",
  ei."subcategoryId",
  ei."vatCategory",
  ei."quantity",
  ei."unitPrice",
  ei."lineTotal",
  ei."unitOfMeasureId",
  ei."purchaseTypeId",
  ei."hasPolicyViolation"
FROM "ExpenseItem" ei
JOIN "_ExpenseBaseMap" m ON m."expenseId" = ei."expenseId";

-- Backfill ApprovalHistory expenseBaseId
UPDATE "ApprovalHistory" ah
SET "expenseBaseId" = m."expenseBaseId"
FROM "_ExpenseBaseMap" m
WHERE ah."expenseId" = m."expenseId" AND ah."expenseBaseId" IS NULL;

-- Add FK and NOT NULL after backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ApprovalHistory_expenseBaseId_fkey'
  ) THEN
    ALTER TABLE "ApprovalHistory"
      ADD CONSTRAINT "ApprovalHistory_expenseBaseId_fkey"
      FOREIGN KEY ("expenseBaseId") REFERENCES "ExpenseBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ApprovalHistory"
  ALTER COLUMN "expenseBaseId" SET NOT NULL;

-- Drop old ApprovalHistory expenseId FK and column
ALTER TABLE "ApprovalHistory" DROP CONSTRAINT IF EXISTS "ApprovalHistory_expenseId_fkey";
DROP INDEX IF EXISTS "ApprovalHistory_expenseId_idx";
ALTER TABLE "ApprovalHistory" DROP COLUMN IF EXISTS "expenseId";

CREATE INDEX IF NOT EXISTS "ApprovalHistory_expenseBaseId_idx" ON "ApprovalHistory"("expenseBaseId");

-- Cleanup temp map
DROP TABLE IF EXISTS "_ExpenseBaseMap";
