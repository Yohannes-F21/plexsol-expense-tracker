"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Search, Plus, SquarePen, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CreateExpenseDialog } from "@/components/create-expense-dialog";
import { EditExpenseDialog } from "@/components/edit-expense-dialog";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Loader } from "@/components/loader";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

type Expense = {
  id: string;
  amount: number;
  description: string;
  currency: string;
  categoryId: string | null;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  createdAt: string;
  priority: "HIGH" | "NORMAL";
  category: { id: string; name: string } | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  receiptUrl?: string | null;
};

export function ExpensesManagement() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["org-admin-expenses", searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      const q = searchTerm.trim();
      if (q) params.set("q", q);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const qs = params.toString();
      const url = qs ? `/api/org-admin/expenses?${qs}` : "/api/org-admin/expenses";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json() as Promise<{ expenses: Expense[] }>;
    },
  });

  const expenses = data?.expenses ?? [];

  const requestDelete = useCallback((expenseId: string) => {
    setDeleteExpenseId(expenseId);
    setDeleteOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteExpenseId) return;

    try {
      const res = await fetch(`/api/expenses/${deleteExpenseId}`, {
        method: "DELETE",
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || "Failed to delete expense");
        return;
      }

      toast.success("Expense deleted");
      setDeleteOpen(false);
      setDeleteExpenseId(null);
      queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["org-admin-stats"] });
    } catch (error) {
      console.error("[v0] Delete expense error:", error);
      toast.error("An error occurred while deleting");
    }
  }, [deleteExpenseId, queryClient]);

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: "user.name",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.user.name}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.user.email}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
      },
      {
        accessorKey: "category.name",
        header: "Category",
        cell: ({ row }) => row.original.category?.name ?? "-",
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.priority === "HIGH" ? "destructive" : "outline"
            }
          >
            {row.original.priority === "HIGH" ? "High" : "Normal"}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) =>
          formatCurrency(row.original.amount, row.original.currency),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          new Date(row.getValue("createdAt")).toLocaleDateString(),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge
              variant={
                status === "APPROVED"
                  ? "default"
                  : status === "REJECTED"
                    ? "destructive"
                    : status === "WARNING"
                      ? "outline"
                      : "secondary"
              }
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "receiptUrl",
        header: "Receipt",
        cell: ({ row }) =>
          row.original.receiptUrl ? (
            <a
              href={row.original.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <FileText className="h-4 w-4" />
              View
            </a>
          ) : (
            <span className="text-muted-foreground">No receipt</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const expense = row.original;
          const locked =
            expense.status === "APPROVED" || expense.status === "REJECTED";

          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingExpense(expense)}
                disabled={locked}
              >
                <SquarePen className="h-4 w-4 text-blue-500" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestDelete(expense.id)}
                disabled={locked}
              >
                <Trash2 className="h-4 w-4 text-red-500 " />
              </Button>
            </div>
          );
        },
      },
    ],
    [requestDelete],
  );

  const table = useReactTable({
    data: expenses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
  });

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, statusFilter, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader size="md" ariaLabel="Loading Expenses" showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expenses Management</h1>
        <p className="text-muted-foreground">
          Review and approve expense requests from your team
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Expense Requests</CardTitle>
            <CardDescription>
              Total: {expenses.length} expense
              {expenses.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex justify-end">
            <CreateExpenseDialog
              trigger={
                <Button>
                  <Plus className=" h-4 w-4" />
                  New Expense
                </Button>
              }
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ["org-admin-expenses"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["org-admin-stats"],
                });
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-45">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <DataTablePagination
              table={table}
              storageKey="org-admin-expenses-page-size"
            />
          </div>
        </CardContent>
      </Card>

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
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] });
            queryClient.invalidateQueries({ queryKey: ["org-admin-stats"] });
          }}
        />
      ) : null}
    </div>
  );
}
