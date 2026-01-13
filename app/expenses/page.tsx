import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ExpensesTable } from "@/components/expenses/expenses-table";

export default async function ExpensesPage() {
  const session = await getSession();

  if (!session || (session.role !== "STAFF" && session.role !== "ORG_ADMIN")) {
    redirect("/signin");
  }

  const role = session.role;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {role === "ORG_ADMIN" ? (
            <>
              <h1 className="text-2xl font-bold">Expense Management</h1>
              <p className="text-muted-foreground">
                Review and approve expense requests from your team
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Expenses</h1>
              <p className="text-sm text-muted-foreground">
                Create and track your receipt submissions.
              </p>
            </>
          )}
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            {role === "ORG_ADMIN" ? <Plus /> : null}
            New Expense
          </Link>
        </Button>
      </div>

      <ExpensesTable role={role} />
    </div>
  );
}
