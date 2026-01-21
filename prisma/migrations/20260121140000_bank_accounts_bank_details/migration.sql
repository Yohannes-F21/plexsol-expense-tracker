-- Reshape BankAccount to store bank details (bankName/accountHolderName/accountNumber)
-- Backfills from prior columns:
--   label -> bankName
--   code  -> accountNumber

-- 1) Rename existing columns
ALTER TABLE "BankAccount" RENAME COLUMN "label" TO "bankName";
ALTER TABLE "BankAccount" RENAME COLUMN "code" TO "accountNumber";

-- 2) Add new column for account holder
ALTER TABLE "BankAccount"
  ADD COLUMN "accountHolderName" TEXT;

-- 3) Backfill holder name for existing rows
UPDATE "BankAccount"
SET "accountHolderName" = COALESCE(NULLIF("accountHolderName", ''), 'N/A')
WHERE "accountHolderName" IS NULL OR "accountHolderName" = '';

-- 4) Enforce NOT NULL after backfill
ALTER TABLE "BankAccount"
  ALTER COLUMN "bankName" SET NOT NULL,
  ALTER COLUMN "accountNumber" SET NOT NULL,
  ALTER COLUMN "accountHolderName" SET NOT NULL;

-- 5) Update unique constraint from (organizationId, code) to (organizationId, accountNumber)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = '"BankAccount"'::regclass
    AND contype = 'u'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "BankAccount" DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE "BankAccount"
  ADD CONSTRAINT "BankAccount_organizationId_accountNumber_key"
  UNIQUE ("organizationId", "accountNumber");

-- 6) Helpful index (keeps existing organizationId indexes if present)
CREATE INDEX IF NOT EXISTS "BankAccount_organizationId_isActive_idx"
  ON "BankAccount"("organizationId", "isActive");
