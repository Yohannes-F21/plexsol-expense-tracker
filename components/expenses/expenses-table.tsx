"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, SquarePen, Trash2, Eye } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { canDeleteExpense, canEditExpense } from "@/lib/expense-permissions";
import { Loader } from "../loader";

type MoneyLike =
  | number
  | string
  | { toNumber: () => number }
  | null
  | undefined;

type ExpenseRow = {
  id: string;
  expenseType: "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL";
  date: string;
  vendor: string;
  reference?: string | null;
  invoiceNumber?: string | null;
  paymentMethod: "CASH" | "CHECK" | "CREDIT_CARD" | "BANK_TRANSFER" | "OTHER";
  total: MoneyLike;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  warningItems?: string[];
  rejectionComment?: string | null;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

const EMPTY_EXPENSES: ExpenseRow[] = [];

function asNumber(x: MoneyLike): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
}

function formatMoney(x: MoneyLike) {
  const n = asNumber(x);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

export function ExpensesTable(props: { role: "ORG_ADMIN" | "STAFF" }) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<
    "all" | "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL"
  >("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", searchTerm, statusFilter, expenseTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      const q = searchTerm.trim();
      if (q) params.set("q", q);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (expenseTypeFilter !== "all")
        params.set("expenseType", expenseTypeFilter);

      const qs = params.toString();
      const url = qs ? `/api/expenses?${qs}` : "/api/expenses";
      const res = await fetch(url);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to fetch expenses");
      return payload as { expenses: ExpenseRow[] };
    },
  });

  const expenses = data?.expenses ?? EMPTY_EXPENSES;

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
        accessorKey: "expenseType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.expenseType;
          const label =
            type === "RECEIPT"
              ? "Receipt"
              : type === "PAYMENT_VOUCHER"
                ? "Payment Voucher"
                : "General";
          return <Badge variant="outline">{label}</Badge>;
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
      },
      {
        accessorKey: "vendor",
        header: "Vendor/Payee",
        cell: ({ row }) => row.original.vendor || "-",
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => (
          <div className="font-mono text-xs">
            {row.original.expenseType === "GENERAL" ? (
              "-"
            ) : row.original.reference ? (
              <>
                <div>{row.original.reference}</div>
                {row.original.expenseType === "RECEIPT" &&
                row.original.invoiceNumber ? (
                  <div className="text-[10px] text-muted-foreground">
                    INV: {row.original.invoiceNumber}
                  </div>
                ) : null}
              </>
            ) : (
              "-"
            )}
          </div>
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

          const tooltipText =
            label === "WARNING"
              ? (row.original.warningItems ?? []).length
                ? `Violation: ${(row.original.warningItems ?? [])
                    .slice(0, 5)
                    .join(", ")}${
                    (row.original.warningItems ?? []).length > 5 ? "…" : ""
                  }`
                : "Violation: policy limit exceeded"
              : label === "REJECTED"
                ? row.original.rejectionComment?.trim()
                  ? `Rejected: ${row.original.rejectionComment.trim()}`
                  : "Rejected: no comment provided"
                : null;

          const badge = (
            <Badge variant="outline" className={`${className} capitalize`}>
              {displayLabel || "-"}
            </Badge>
          );

          if (!tooltipText) return badge;

          return (
            <Tooltip>
              <TooltipTrigger asChild>{badge}</TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
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
      },
    );

    return cols;
  }, [props.role]);

  const isExpenseTypeFilterValue = (
    value: string,
  ): value is "all" | "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL" =>
    value === "all" ||
    value === "RECEIPT" ||
    value === "PAYMENT_VOUCHER" ||
    value === "GENERAL";

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
  }, [sorting, statusFilter, expenseTypeFilter, searchTerm]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          {/* <CardTitle>Expenses</CardTitle> */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor, reference, invoice, description..."
                className="pl-8 w-72"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter: Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={expenseTypeFilter}
              onValueChange={(v) => {
                if (isExpenseTypeFilterValue(v)) setExpenseTypeFilter(v);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter: Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="RECEIPT">Receipt</SelectItem>
                <SelectItem value="PAYMENT_VOUCHER">Payment Voucher</SelectItem>
                <SelectItem value="GENERAL">General</SelectItem>
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
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10">
                      <div className="flex items-center justify-center">
                        <Loader
                          size="md"
                          ariaLabel="Loading Expenses"
                          showLabel
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
