"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["org-admin-expenses"],
    queryFn: async () => {
      const res = await fetch("/api/org-admin/expenses");
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json() as Promise<{ expenses: Expense[] }>;
    },
  });

  const expenses = data?.expenses ?? [];

  const handleDelete = useCallback(
    async (expenseId: string) => {
      if (!confirm("Delete this expense?")) return;

      try {
        const res = await fetch(`/api/expenses/${expenseId}`, {
          method: "DELETE",
        });

        const payload = await res.json();
        if (!res.ok) {
          toast.error(payload.error || "Failed to delete expense");
          return;
        }

        toast.success("Expense deleted");
        queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] });
        queryClient.invalidateQueries({ queryKey: ["org-admin-stats"] });
      } catch (error) {
        console.error("[v0] Delete expense error:", error);
        toast.error("An error occurred while deleting");
      }
    },
    [queryClient]
  );

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
                onClick={() => handleDelete(expense.id)}
                disabled={locked}
              >
                <Trash2 className="h-4 w-4 text-red-500 " />
              </Button>
            </div>
          );
        },
      },
    ],
    [handleDelete]
  );

  const filteredData = useMemo(() => {
    return expenses.filter((expense) =>
      statusFilter === "all" ? true : expense.status === statusFilter
    );
  }, [expenses, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading expenses...</div>
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
              Total: {filteredData.length} expense
              {filteredData.length !== 1 ? "s" : ""}
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
                value={
                  (table
                    .getColumn("description")
                    ?.getFilterValue() as string) ?? ""
                }
                onChange={(e) =>
                  table.getColumn("description")?.setFilterValue(e.target.value)
                }
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
                              header.getContext()
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
                            cell.getContext()
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
        </CardContent>
      </Card>

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
