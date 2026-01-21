-- Convert BankAccount.label from integer to text
-- Safe for existing numeric values (casts int -> text)

ALTER TABLE "BankAccount"
  ALTER COLUMN "label" TYPE TEXT USING "label"::text;
