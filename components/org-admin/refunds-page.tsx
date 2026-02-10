"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/loader";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const refundSchema = z
  .object({
    fromAccountId: z.string().min(1, "Select a source account"),
    toAccountId: z.string().min(1, "Select a destination account"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    remark: z.string().trim().min(1, "Remark is required"),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "From and to accounts must differ",
    path: ["toAccountId"],
  });

type RefundStatus = "PENDING" | "APPROVED" | "REJECTED";

type BankAccount = {
  id: string;
  bankName: string;
  accountHolderName?: string | null;
  accountNumber: string;
  balance: string;
  initialBalance?: string;
};

type RefundRow = {
  id: string;
  amount: string;
  status: RefundStatus;
  remark: string;
  rejectionReason: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  requester?: { id: string; name: string | null; email: string };
  fromAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    balance: string;
  };
  toAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    balance: string;
  };
};

const REFUNDS_QUERY_KEY = ["org-admin-refunds"] as const;
const BANK_ACCOUNTS_QUERY_KEY = ["org-admin-bank-accounts"] as const;

type RefundFormValues = z.infer<typeof refundSchema>;

const ALL_FILTER = "__ALL__";

function formatCurrency(value: string | number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const variant =
    status === "APPROVED"
      ? "success"
      : status === "REJECTED"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant as never}>{status}</Badge>;
}

function RejectionReasonPopover({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs text-destructive underline underline-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          View reason
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        className="w-80"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-1">
          <div className="text-sm font-medium">Rejection reason</div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {reason}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RefundsPage() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [accountFilterId, setAccountFilterId] = useState<string>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<
    RefundStatus | typeof ALL_FILTER
  >(ALL_FILTER);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [activeRefund, setActiveRefund] = useState<RefundRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const form = useForm<RefundFormValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: 0,
      remark: "",
    },
  });

  const refundsQuery = useQuery<{ refunds: RefundRow[] }>({
    queryKey: REFUNDS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/org-admin/refunds", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load refunds");
      return payload as { refunds: RefundRow[] };
    },
  });

  const refunds = useMemo(
    () => refundsQuery.data?.refunds ?? [],
    [refundsQuery.data],
  );

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      const matchesAccount =
        accountFilterId !== ALL_FILTER
          ? r.fromAccount.id === accountFilterId ||
            r.toAccount.id === accountFilterId
          : true;
      const matchesStatus =
        statusFilter !== ALL_FILTER ? r.status === statusFilter : true;
      return matchesAccount && matchesStatus;
    });
  }, [refunds, accountFilterId, statusFilter]);

  const bankAccountsQuery = useQuery<{ bankAccounts: BankAccount[] }>({
    queryKey: BANK_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/org-admin/bank-accounts", {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to load bank accounts");
      return payload as { bankAccounts: BankAccount[] };
    },
  });

  const bankAccounts = useMemo(
    () => bankAccountsQuery.data?.bankAccounts ?? [],
    [bankAccountsQuery.data],
  );

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/org-admin/refunds/${id}/approve`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to approve refund");
      return payload;
    },
    onSuccess: () => {
      toast.success("Refund approved");
      queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
      setDialogAction(null);
      setActiveRefund(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: async (values: RefundFormValues) => {
      const res = await fetch("/api/org-admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to submit refund");
      return payload;
    },
    onSuccess: () => {
      toast.success("Refund created");
      queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
      form.reset({ fromAccountId: "", toAccountId: "", amount: 0, remark: "" });
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (args: { id: string; reason: string }) => {
      const res = await fetch(`/api/org-admin/refunds/${args.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: args.reason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to reject refund");
      return payload;
    },
    onSuccess: () => {
      toast.success("Refund rejected");
      queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
      setDialogAction(null);
      setActiveRefund(null);
      setRejectReason("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const columns = useMemo<ColumnDef<RefundRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "decisionDate",
        header: "Approved/Rejected",
        cell: ({ row }) => {
          const value = row.original.approvedAt || row.original.rejectedAt;
          return value ? new Date(value).toLocaleDateString() : "-";
        },
      },
      {
        accessorKey: "requester",
        header: "Requester",
        cell: ({ row }) =>
          row.original.requester?.name || row.original.requester?.email || "-",
      },
      {
        accessorKey: "fromAccount",
        header: "From Account",
        cell: ({ row }) => (
          <div className="text-destructive">
            {row.original.fromAccount.bankName} -{" "}
            {row.original.fromAccount.accountNumber}
          </div>
        ),
      },
      {
        accessorKey: "toAccount",
        header: "To Account",
        cell: ({ row }) => (
          <div className="text-emerald-600">
            {row.original.toAccount.bankName} -{" "}
            {row.original.toAccount.accountNumber}
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="font-medium">
            {formatCurrency(row.original.amount)}
          </div>
        ),
      },
      {
        id: "fromBalance",
        header: "From Balance",
        cell: ({ row }) =>
          row.original.status === "APPROVED"
            ? formatCurrency(row.original.fromAccount.balance)
            : "-",
      },
      {
        id: "toBalance",
        header: "To Balance",
        cell: ({ row }) =>
          row.original.status === "APPROVED"
            ? formatCurrency(row.original.toAccount.balance)
            : "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.status} />
            <div>
              {row.original.status === "REJECTED" &&
              row.original.rejectionReason ? (
                <RejectionReasonPopover reason={row.original.rejectionReason} />
              ) : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "remark",
        header: "Remark",
        cell: ({ row }) => row.original.remark,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          if (row.original.status !== "PENDING") return null;
          return (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setActiveRefund(row.original);
                  setDialogAction("approve");
                }}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActiveRefund(row.original);
                  setDialogAction("reject");
                  setRejectReason("");
                }}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    [approveMutation.isPending, rejectMutation.isPending],
  );

  const table = useReactTable({
    data: filteredRefunds,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Reset to first page when filters change.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [accountFilterId, statusFilter]);

  const isLoading = refundsQuery.isLoading;
  const isSubmitting = approveMutation.isPending || rejectMutation.isPending;
  const isCreating = createMutation.isPending;
  const loadingAny = isLoading || bankAccountsQuery.isLoading;

  if (refundsQuery.isError || bankAccountsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Failed to load refunds or accounts.
      </div>
    );
  }

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Review refund requests and approve or reject them.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>New Refund</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
          <CardDescription>
            Manage transfers between bank accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={accountFilterId}
                onValueChange={setAccountFilterId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All accounts</SelectItem>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName} - {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as RefundStatus | typeof ALL_FILTER)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="APPROVED">APPROVED</SelectItem>
                  <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                {loadingAny ? (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <div className="flex items-center justify-center py-8">
                        <Loader
                          size="md"
                          ariaLabel="Loading refunds"
                          showLabel
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length ? (
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
                      No refunds yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <DataTablePagination
              table={table}
              storageKey="org-admin-refunds-page-size"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Refund</DialogTitle>
            <DialogDescription>
              Create a refund request. Balances change only after approval.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutate(values),
            )}
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromAccount">From Account</Label>
                <Select
                  value={form.watch("fromAccountId")}
                  onValueChange={(value) =>
                    form.setValue("fromAccountId", value, {
                      shouldValidate: true,
                    })
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger id="fromAccount">
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.fromAccountId?.message ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.fromAccountId.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="toAccount">To Account</Label>
                <Select
                  value={form.watch("toAccountId")}
                  onValueChange={(value) =>
                    form.setValue("toAccountId", value, {
                      shouldValidate: true,
                    })
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger id="toAccount">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.toAccountId?.message ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.toAccountId.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={isCreating}
                {...form.register("amount", { valueAsNumber: true })}
              />
              {form.formState.errors.amount?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remark">Remark</Label>
              <Input
                id="remark"
                type="text"
                placeholder="Reason for refund"
                disabled={isCreating}
                {...form.register("remark")}
              />
              {form.formState.errors.remark?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.remark.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Submitting..." : "Submit Refund"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(dialogAction && activeRefund)}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAction(null);
            setActiveRefund(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve refund" : "Reject refund"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "Confirm approving this refund. Balances will be updated."
                : "Provide a rejection reason. No balances will change."}
            </DialogDescription>
          </DialogHeader>

          {dialogAction === "reject" ? (
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Add rejection reason"
              disabled={isMutating}
            />
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setDialogAction(null);
                setActiveRefund(null);
                setRejectReason("");
              }}
              disabled={isMutating}
            >
              Cancel
            </Button>
            {dialogAction === "approve" ? (
              <Button
                onClick={() =>
                  activeRefund && approveMutation.mutate(activeRefund.id)
                }
                disabled={!activeRefund || isMutating}
              >
                {isMutating ? "Approving..." : "Approve"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() =>
                  activeRefund &&
                  rejectMutation.mutate({
                    id: activeRefund.id,
                    reason: rejectReason,
                  })
                }
                disabled={!activeRefund || !rejectReason.trim() || isMutating}
              >
                {isMutating ? "Rejecting..." : "Reject"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
