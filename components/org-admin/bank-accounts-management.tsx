"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Power, PowerOff } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type BankAccount = {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  initialBalance: string;
  balance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const bankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  initialBalance: z.coerce
    .number()
    .min(0, "Initial balance cannot be negative")
    .default(0),
});

type BankAccountFormValues = z.infer<typeof bankAccountSchema>;
type UpdateBankAccountFormValues = Omit<
  BankAccountFormValues,
  "initialBalance"
>;

const BANK_ACCOUNTS_QUERY_KEY = ["org-admin-bank-accounts"] as const;

export function BankAccountsManagement() {
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<BankAccount | null>(null);

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

  const bankAccounts = bankAccountsQuery.data?.bankAccounts ?? [];

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      initialBalance: 0,
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;
    form.reset({
      bankName: selected?.bankName ?? "",
      accountHolderName: selected?.accountHolderName ?? "",
      accountNumber: selected?.accountNumber ?? "",
      initialBalance: selected ? Number(selected.initialBalance) : 0,
    });
  }, [dialogOpen, selected, form]);

  const createMutation = useMutation({
    mutationFn: async (values: BankAccountFormValues) => {
      const res = await fetch("/api/org-admin/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to create bank account");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      toast.success("Bank account created");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      values: UpdateBankAccountFormValues;
    }) => {
      const res = await fetch(`/api/org-admin/bank-accounts/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to update bank account");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      toast.success("Bank account updated");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (args: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/org-admin/bank-accounts/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: args.isActive }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          payload.error || "Failed to update bank account status",
        );
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      toast.success("Status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateDialog() {
    setSelected(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEditDialog(bankAccount: BankAccount) {
    setSelected(bankAccount);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  async function handleSubmit(values: BankAccountFormValues) {
    if (dialogMode === "create") {
      await createMutation.mutateAsync(values);
      return;
    }

    if (!selected) throw new Error("No bank account selected");
    // Initial balance is set only on creation; exclude on updates
    const { initialBalance: _omit, ...rest } = values;
    await updateMutation.mutateAsync({ id: selected.id, values: rest });
  }

  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        accessorKey: "bankName",
        header: "Bank Name",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.bankName}</div>
        ),
      },
      {
        accessorKey: "accountHolderName",
        header: "Account Holder",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.accountHolderName}</div>
        ),
      },
      {
        accessorKey: "accountNumber",
        header: "Account Number",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.accountNumber}</div>
        ),
      },
      {
        accessorKey: "initialBalance",
        header: "Initial Balance",
        cell: ({ row }) => (
          <div>
            {Number(row.original.initialBalance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => (
          <div className="font-medium">
            {Number(row.original.balance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => {
          const date = new Date(row.original.updatedAt);
          return <div>{date.toLocaleDateString()}</div>;
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const bankAccount = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(bankAccount)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {bankAccount.isActive ? (
                  <DropdownMenuItem
                    onClick={() =>
                      toggleMutation.mutate({
                        id: bankAccount.id,
                        isActive: false,
                      })
                    }
                    className="text-destructive"
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      toggleMutation.mutate({
                        id: bankAccount.id,
                        isActive: true,
                      })
                    }
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Activate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [toggleMutation],
  );

  const table = useReactTable({
    data: bankAccounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  if (bankAccountsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    await handleSubmit(values);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <Input
          placeholder="Filter bank accounts..."
          value={
            (table.getColumn("accountNumber")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("accountNumber")?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Bank Account
        </Button>
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
                  No bank accounts.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create"
                ? "Add Bank Account"
                : "Edit Bank Account"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Add a new bank account."
                : "Update the bank account."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bankAccountLabel">Bank Name</Label>
              <Input
                id="bankAccountLabel"
                placeholder="Enter bank name"
                {...form.register("bankName")}
              />
              {form.formState.errors.bankName ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.bankName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccountHolder">Account Holder Name</Label>
              <Input
                id="bankAccountHolder"
                placeholder="Enter account holder name"
                {...form.register("accountHolderName")}
              />
              {form.formState.errors.accountHolderName ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.accountHolderName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccountCode">Account Number</Label>
              <Input
                id="bankAccountCode"
                placeholder="Enter account number"
                {...form.register("accountNumber")}
              />
              {form.formState.errors.accountNumber ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.accountNumber.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccountInitialBalance">Initial Balance</Label>
              <Input
                id="bankAccountInitialBalance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={dialogMode === "edit"}
                {...form.register("initialBalance", { valueAsNumber: true })}
              />
              {form.formState.errors.initialBalance ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.initialBalance.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
