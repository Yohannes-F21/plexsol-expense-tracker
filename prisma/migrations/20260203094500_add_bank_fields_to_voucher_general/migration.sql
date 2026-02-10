-- Add bank fields to PaymentVoucherExpense
ALTER TABLE "PaymentVoucherExpense"
  ADD COLUMN IF NOT EXISTS "checkNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentVoucherExpense_bankAccountId_fkey'
  ) THEN
    ALTER TABLE "PaymentVoucherExpense"
      ADD CONSTRAINT "PaymentVoucherExpense_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add bank fields to GeneralExpense
ALTER TABLE "GeneralExpense"
  ADD COLUMN IF NOT EXISTS "checkNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GeneralExpense_bankAccountId_fkey'
  ) THEN
    ALTER TABLE "GeneralExpense"
      ADD CONSTRAINT "GeneralExpense_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
