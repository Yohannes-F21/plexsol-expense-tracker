"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, SquarePen, Trash2, Eye } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { canDeleteExpense, canEditExpense } from "@/lib/expense-permissions";

type ExpenseRow = {
  id: string;
  purchasedDate: string;
  companyName: string;
  tinNumber: string;
  fsNumber: string;
  mrcNumber?: string | null;
  paymentMethod: "CASH" | "CHECK" | "CREDIT_CARD" | "BANK_TRANSFER" | "OTHER";
  subtotal: any;
  vat: any;
  total: any;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
}

function formatMoney(x: any) {
  const n = asNumber(x);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

export function ExpensesTable(props: { role: "ORG_ADMIN" | "STAFF" }) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to fetch expenses");
      return payload as { expenses: ExpenseRow[] };
    },
  });

  const expenses = data?.expenses ?? [];

  const handleDelete = async (expenseId: string) => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || "Failed to delete expense");
        return;
      }

      toast.success("Expense deleted");
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } catch (e) {
      console.error("[v0] Delete expense error:", e);
      toast.error("An error occurred while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(() => {
    const cols: ColumnDef<ExpenseRow>[] = [];

    if (props.role === "ORG_ADMIN") {
      cols.push({
        accessorKey: "createdByUser.email",
        header: "Employee",
        cell: ({ row }) => {
          const u = row.original.createdByUser;
          return (
            <div>
              <div className="font-medium">{u?.name || "-"}</div>
              <div className="text-xs text-muted-foreground">
                {u?.email || "-"}
              </div>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        accessorKey: "purchasedDate",
        header: "Purchased",
        cell: ({ row }) =>
          new Date(row.original.purchasedDate).toLocaleDateString(),
      },
      {
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => row.original.companyName,
      },
      {
        accessorKey: "fsNumber",
        header: "FS",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.fsNumber}</span>
        ),
      },
      {
        accessorKey: "tinNumber",
        header: "TIN",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.tinNumber}</span>
        ),
      },
      {
        accessorKey: "mrcNumber",
        header: "MRC",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.mrcNumber || "-"}
          </span>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: "Payment",
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.paymentMethod.toLowerCase().replace(/_/g, " ")}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold font-mono">
            {formatMoney(row.original.total)}
            <span className="ml-1">ETB</span>
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const label = String(status ?? "");
          const displayLabel = label ? label.toLowerCase() : "";

          const className =
            label === "PENDING"
              ? "text-yellow-600 bg-orange-100  text-xs"
              : label === "APPROVED"
              ? "text-green-600 bg-green-100  text-xs"
              : label === "REJECTED"
              ? "text-red-600 bg-red-100  text-xs"
              : label === "WARNING"
              ? "text-orange-600 bg-orange-100  text-xs"
              : "text-muted-foreground";

          return (
            <Badge variant="outline" className={`${className} capitalize`}>
              {displayLabel || "-"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const expense = row.original;
          const base = "/expenses";
          const canEdit = canEditExpense({
            role: props.role,
            status: expense.status,
          });
          const canDelete = canDeleteExpense({
            role: props.role,
            status: expense.status,
          });

          return (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/${expense.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
              {!canEdit ? (
                <Button size="sm" variant="outline" disabled>
                  <SquarePen className="h-4 w-4" />
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${base}/${expense.id}/edit`}>
                    <SquarePen className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!canDelete) {
                    if (expense.status === "APPROVED") {
                      toast.error("Approved expenses cannot be deleted");
                    } else if (expense.status === "REJECTED") {
                      toast.error("Rejected expenses cannot be deleted");
                    } else {
                      toast.error("You cannot delete this expense");
                    }
                    return;
                  }
                  setDeleteTarget(expense);
                  setDeleteOpen(true);
                }}
                disabled={!canDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      }
    );

    return cols;
  }, [props.role]);

  const filteredData = useMemo(() => {
    return expenses.filter((e) =>
      statusFilter === "all" ? true : e.status === statusFilter
    );
  }, [expenses, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination: { pageIndex, pageSize },
    },
  });

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, sorting, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-muted-foreground">Loading expenses...</div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          {/* <CardTitle>Expenses</CardTitle> */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company..."
                className="pl-8 w-56"
                onChange={(e) =>
                  table.getColumn("companyName")?.setFilterValue(e.target.value)
                }
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                        <TableCell key={cell.id}>
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
                      No Expense Found!!!.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <DataTablePagination
              table={table}
              storageKey={`${props.role.toLowerCase()}-expenses-page-size`}
            />
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Delete expense?"
        description="This will remove the expense from active use. Existing records will keep their history."
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (
            !canDeleteExpense({ role: props.role, status: deleteTarget.status })
          ) {
            if (deleteTarget.status === "APPROVED") {
              toast.error("Approved expenses cannot be deleted");
            } else if (deleteTarget.status === "REJECTED") {
              toast.error("Rejected expenses cannot be deleted");
            } else {
              toast.error("You cannot delete this expense");
            }
            setDeleteOpen(false);
            setDeleteTarget(null);
            return;
          }
          await handleDelete(deleteTarget.id);
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
