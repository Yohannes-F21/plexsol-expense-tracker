"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ReceiptExpenseForm,
  type ReceiptExpenseDetail,
} from "@/components/expenses/receipt-expense-form";

export default function OrgAdminEditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load expense");
      return payload as { expense: ReceiptExpenseDetail };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error)
    return <div className="text-destructive">{(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit Expense</h1>
          <p className="text-sm text-muted-foreground">
            Update receipt info and items.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/org-admin/expenses/${id}`}>Back</Link>
        </Button>
      </div>

      <ReceiptExpenseForm
        mode="edit"
        role="ORG_ADMIN"
        expenseId={id}
        initial={data?.expense ?? null}
      />
    </div>
  );
}
