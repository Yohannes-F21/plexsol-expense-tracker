"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type RefundFormValues = z.infer<typeof refundSchema>;

type RefundStatus = "PENDING" | "APPROVED" | "REJECTED";

type BankAccount = {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  balance: string;
  initialBalance: string;
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

const BANK_ACCOUNTS_QUERY_KEY = ["staff-bank-accounts"] as const;
const REFUNDS_QUERY_KEY = ["staff-refunds"] as const;

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

export function StaffRefundsPage() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      const res = await fetch("/api/staff/refunds", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load refunds");
      return payload as { refunds: RefundRow[] };
    },
  });

  const bankAccountsQuery = useQuery<{ bankAccounts: BankAccount[] }>({
    queryKey: BANK_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/staff/bank-accounts", {
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
  const refunds = useMemo(
    () => refundsQuery.data?.refunds ?? [],
    [refundsQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: async (values: RefundFormValues) => {
      const res = await fetch("/api/staff/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to submit refund");
      return payload;
    },
    onSuccess: () => {
      toast.success("Refund request submitted");
      queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
      form.reset({ fromAccountId: "", toAccountId: "", amount: 0, remark: "" });
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSubmit = form.handleSubmit((values) => {
    const fromAccount = bankAccounts.find(
      (account) => account.id === values.fromAccountId,
    );
    const toAccount = bankAccounts.find(
      (account) => account.id === values.toAccountId,
    );

    if (!fromAccount || !toAccount) {
      toast.error("Select valid accounts");
      return;
    }

    createMutation.mutate(values);
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
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "remark",
        header: "Remark",
        cell: ({ row }) => row.original.remark,
      },
      {
        accessorKey: "rejectionReason",
        header: "Rejection Reason",
        cell: ({ row }) =>
          row.original.status === "REJECTED"
            ? row.original.rejectionReason
            : "-",
      },
    ],
    [],
  );

  const table = useReactTable({
    data: refunds,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isLoading = bankAccountsQuery.isLoading || refundsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (bankAccountsQuery.isError || refundsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Failed to load refunds or accounts.
      </div>
    );
  }

  const isSubmitting = createMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Submit a refund request between bank accounts.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>New Refund</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Refunds</CardTitle>
          <CardDescription>
            Track your submitted refund requests.
          </CardDescription>
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
                {table.getRowModel().rows.length ? (
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Refund</DialogTitle>
            <DialogDescription>
              Submit a refund request. Balances change only after approval.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Refund"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
