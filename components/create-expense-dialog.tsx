"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseForm, type ExpenseFormValues } from "@/components/expense-form";
import { toast } from "sonner";

type CreateExpenseDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
  trigger?: React.ReactNode;
};

export function CreateExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  trigger,
}: CreateExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const queryClient = useQueryClient();

  const isControlled = typeof open === "boolean";
  const actualOpen = isControlled ? (open as boolean) : internalOpen;
  const setOpen = useMemo(() => {
    return (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    };
  }, [isControlled, onOpenChange]);

  const createMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create expense");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Expense created successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] });
      setOpen(false);
      onSuccess();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create expense"
      );
    },
  });

  useEffect(() => {
    if (!actualOpen) {
      createMutation.reset();
    }
  }, [actualOpen, createMutation]);

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Expense</DialogTitle>
          <DialogDescription>
            Submit a new expense request with category and priority
          </DialogDescription>
        </DialogHeader>
        <ExpenseForm
          categoriesEnabled={actualOpen}
          submitLabel="Create Expense"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutateAsync(values)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
