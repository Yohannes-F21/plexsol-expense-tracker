"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseForm, type ExpenseFormValues } from "@/components/expense-form";
import { toast } from "sonner";

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  categoryId: string | null;
  priority: "HIGH" | "NORMAL";
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
};

type EditExpenseDialogProps = {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSuccess,
}: EditExpenseDialogProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update expense");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Expense updated");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update expense"
      );
    },
  });

  useEffect(() => {
    if (!open) {
      updateMutation.reset();
    }
  }, [open, updateMutation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>Update your expense request</DialogDescription>
        </DialogHeader>
        <ExpenseForm
          submitLabel="Update Expense"
          defaultValues={{
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            categoryId: expense.categoryId ?? "",
            priority: expense.priority,
          }}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutateAsync(values)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
