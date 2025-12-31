import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReceiptExpenseForm } from "@/components/expenses/receipt-expense-form";

export default function StaffNewExpensePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Expense</h1>
          <p className="text-sm text-muted-foreground">
            Submit a receipt with item lines.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/expenses">Back</Link>
        </Button>
      </div>

      <ReceiptExpenseForm mode="create" role="STAFF" />
    </div>
  );
}
