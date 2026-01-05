import React from "react";
import { QueryProvider } from "@/lib/query-provider";
import { ExpensesTable } from "@/components/super-admin/expenses-table";

export default function SuperAdminExpensesPage() {
  return (
    <QueryProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground mt-1">
            Manage all Expenses in the system
          </p>
        </div>
        <ExpensesTable />
      </div>
    </QueryProvider>
  );
}
