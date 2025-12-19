import React from "react";
import { QueryProvider } from "@/lib/query-provider";
import { ExpensesTable } from "@/components/super-admin/expenses-table";

export default function SuperAdminExpensesPage() {
  return (
    <QueryProvider>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
        <ExpensesTable />
      </div>
    </QueryProvider>
  );
}
