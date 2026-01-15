"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ReceiptExpenseForm,
  type ReceiptExpenseDetail,
} from "@/components/expenses/receipt-expense-form";
import { canEditExpense } from "@/lib/expense-permissions";
import { BackButton } from "@/components/back-button";

export function ExpenseFormPage(props: {
  role: "STAFF" | "ORG_ADMIN";
  mode: "create" | "edit";
  expenseId?: string;
  backHref: string;
}) {
  const id = props.expenseId ?? null;

  const query = useQuery({
    queryKey: ["expense", id],
    enabled: props.mode === "edit" && Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load expense");
      return payload as { expense: ReceiptExpenseDetail };
    },
  });

  if (props.mode === "edit") {
    if (query.isLoading)
      return <div className="text-muted-foreground">Loading...</div>;
    if (query.error)
      return (
        <div className="text-destructive">{(query.error as Error).message}</div>
      );

    const expense = query.data?.expense;
    if (
      expense &&
      !canEditExpense({ role: props.role, status: expense.status })
    ) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Edit Expense</h1>
              <p className="text-sm text-muted-foreground">
                This expense can’t be edited.
              </p>
            </div>
            <BackButton href={props.backHref} />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {props.mode === "create" ? "New Expense" : "Edit Expense"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {props.mode === "create"
              ? "Submit a receipt with item lines."
              : "Update receipt info and items."}
          </p>
        </div>
        <BackButton href={props.backHref} />
      </div>

      <ReceiptExpenseForm
        mode={props.mode}
        role={props.role}
        expenseId={id ?? undefined}
        initial={
          props.mode === "edit" ? query.data?.expense ?? null : undefined
        }
      />
    </div>
  );
}
