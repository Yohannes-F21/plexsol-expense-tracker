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
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "From and to accounts must differ",
    path: ["toAccountId"],
  });

type RefundFormValues = z.infer<typeof refundSchema>;

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
  createdAt: string;
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

const BANK_ACCOUNTS_QUERY_KEY = ["org-admin-bank-accounts"] as const;
const REFUNDS_QUERY_KEY = ["org-admin-refunds"] as const;

export function RefundsPage() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<RefundFormValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: 0,
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

  const refunds = useMemo(
    () => refundsQuery.data?.refunds ?? [],
    [refundsQuery.data],
  );

  const refundMutation = useMutation({
    mutationFn: async (values: RefundFormValues) => {
      const res = await fetch("/api/org-admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to submit refund");
      return payload as { success: boolean };
    },
    onSuccess: () => {
      toast.success("Refund completed");
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
      form.reset({ fromAccountId: "", toAccountId: "", amount: 0 });
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSubmit = form.handleSubmit((values) => {
    const fromAccount = bankAccounts.find(
      (account) => account.id === values.fromAccountId,
    );

    if (!fromAccount) {
      toast.error("Select a source account");
      return;
    }

    const balance = Number(fromAccount.balance);
    const amount = Number(values.amount);

    if (Number.isFinite(balance) && balance < amount) {
      toast.error("Insufficient balance");
      return;
    }

    refundMutation.mutate(values);
  });

  const columns = useMemo<ColumnDef<RefundRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return <div>{date.toLocaleString()}</div>;
        },
      },
      {
        accessorKey: "fromAccount",
        header: "From",
        cell: ({ row }) => (
          <div className="text-destructive">
            {row.original.fromAccount.bankName} -{" "}
            {row.original.fromAccount.accountNumber}
          </div>
        ),
      },
      {
        accessorKey: "toAccount",
        header: "To",
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
            {Number(row.original.amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        id: "fromBalance",
        header: "From Balance",
        cell: ({ row }) => (
          <div className="font-medium text-destructive">
            {Number(row.original.fromAccount.balance).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}
          </div>
        ),
      },
      {
        id: "toBalance",
        header: "To Balance",
        cell: ({ row }) => (
          <div className="font-medium text-emerald-600">
            {Number(row.original.toAccount.balance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ),
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

  if (bankAccountsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Failed to load bank accounts.
      </div>
    );
  }

  if (refundsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Failed to load refunds.
      </div>
    );
  }

  const isSubmitting = refundMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Review recent refunds and transfer funds between accounts.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>New Refund</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund History</CardTitle>
          <CardDescription>Latest transfers between accounts.</CardDescription>
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
              Move funds between bank accounts. Source balance will be deducted.
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
                        {account.bankName} - {account.accountNumber} (PHP{" "}
                        {Number(account.balance).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        )
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
                        {account.bankName} - {account.accountNumber} (PHP{" "}
                        {Number(account.balance).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        )
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
                {isSubmitting ? "Processing..." : "Submit Refund"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
