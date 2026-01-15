"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  CheckCircle,
  XCircle,
  DollarSign,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import { CreateExpenseDialog } from "@/components/create-expense-dialog";
import { EditExpenseDialog } from "@/components/edit-expense-dialog";
import { formatCurrency } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  priority: "HIGH" | "NORMAL";
  createdAt: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  policyViolation?: { maxAmount?: number; amount?: number } | null;
};

export function StaffDashboard() {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load expenses");
      }
      return payload as { expenses: Expense[] };
    },
  });

  const expenses = data?.expenses ?? [];

  const stats = useMemo(() => {
    const total = expenses.length;
    const pending = expenses.filter(
      (e) => e.status === "PENDING" || e.status === "WARNING"
    ).length;
    const approved = expenses.filter((e) => e.status === "APPROVED").length;
    const rejected = expenses.filter((e) => e.status === "REJECTED").length;
    const approvedTotal = expenses
      .filter((e) => e.status === "APPROVED")
      .reduce((sum, e) => sum + e.amount, 0);

    return { total, pending, approved, rejected, approvedTotal };
  }, [expenses]);

  const requestDelete = (expenseId: string) => {
    setDeleteExpenseId(expenseId);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteExpenseId) return;

    try {
      const response = await fetch(`/api/expenses/${deleteExpenseId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to delete expense");
        return;
      }

      toast.success("Expense deleted");
      setDeleteOpen(false);
      setDeleteExpenseId(null);
      refetch();
    } catch (error) {
      console.error("[v0] Delete expense error:", error);
      toast.error("An error occurred");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" ariaLabel="Loading dashboard" showLabel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Expenses</h1>
          <CreateExpenseDialog
            trigger={
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Expense
              </Button>
            }
            onSuccess={refetch}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Expenses
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending / Warning
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Approved Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.approvedTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Expense Requests</CardTitle>
              <CardDescription>
                Track and manage your expense submissions
              </CardDescription>
            </div>
            <CreateExpenseDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Expense
                </Button>
              }
              onSuccess={refetch}
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses yet. Create your first expense request!
                </p>
              ) : (
                expenses.map((expense) => {
                  const canModify =
                    expense.status === "PENDING" ||
                    expense.status === "WARNING";
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            {expense.description}
                          </h3>
                          <Badge
                            variant={
                              expense.status === "APPROVED"
                                ? "default"
                                : expense.status === "REJECTED"
                                ? "destructive"
                                : expense.status === "WARNING"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {expense.status}
                          </Badge>
                          <Badge
                            variant={
                              expense.priority === "HIGH"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {expense.priority === "HIGH" ? "High" : "Normal"}
                          </Badge>
                          {expense.category?.name ? (
                            <Badge variant="secondary">
                              {expense.category.name}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{formatCurrency(expense.amount)}</span>
                          <span>
                            {new Date(expense.createdAt).toLocaleDateString()}
                          </span>
                          {expense.policyViolation?.maxAmount ? (
                            <span className="text-amber-600">
                              Over policy limit{" "}
                              {formatCurrency(
                                expense.policyViolation.maxAmount
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {canModify ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingExpense(expense)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => requestDelete(expense.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteExpenseId(null);
        }}
        title="Delete expense?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      {editingExpense ? (
        <EditExpenseDialog
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          onSuccess={refetch}
        />
      ) : null}
    </div>
  );
}
