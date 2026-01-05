import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import { Plus } from "lucide-react";

export default function OrgAdminExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses Management</h1>
          <p className="text-muted-foreground">
            Review and approve expense requests from your team
          </p>
        </div>
        <Button asChild>
          <Link href="/org-admin/expenses/new">
            <Plus></Plus>
            New Expense
          </Link>
        </Button>
      </div>

      <ExpensesTable role="ORG_ADMIN" />
    </div>
  );
}
