import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExpensesTable } from "@/components/expenses/expenses-table";

export default function StaffExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Create and track your receipt submissions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/expenses/new">New Expense</Link>
        </Button>
      </div>

      <ExpensesTable role="STAFF" />
    </div>
  );
}
