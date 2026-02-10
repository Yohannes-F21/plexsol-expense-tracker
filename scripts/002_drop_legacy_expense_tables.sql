-- Drops legacy receipt-only tables that were replaced by ExpenseBase + subtype tables.
--
-- WARNING: This is destructive and will permanently delete data in these tables.
-- Only run this after confirming you no longer need legacy Expense/ExpenseItem data.

DROP TABLE IF EXISTS "ExpenseItem" CASCADE;
DROP TABLE IF EXISTS "Expense" CASCADE;
