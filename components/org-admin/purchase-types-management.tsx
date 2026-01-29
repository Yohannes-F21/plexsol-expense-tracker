"use client";

import { useMemo, useState } from "react";
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
  MasterDataDialog,
  type MasterDataFormValues,
} from "@/components/org-admin/master-data-dialog";

type PurchaseType = {
  id: string;
  label: number;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const PURCHASE_TYPES_QUERY_KEY = ["org-admin-purchase-types"] as const;

export function PurchaseTypesManagement() {
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<PurchaseType | null>(null);

  const purchaseTypesQuery = useQuery<{ purchaseTypes: PurchaseType[] }>({
    queryKey: [...PURCHASE_TYPES_QUERY_KEY, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      const q = searchTerm.trim();
      if (q) params.set("q", q);
      const qs = params.toString();
      const url = qs
        ? `/api/org-admin/purchase-types?${qs}`
        : "/api/org-admin/purchase-types";
      const res = await fetch(url, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to load purchase types");
      return payload as { purchaseTypes: PurchaseType[] };
    },
  });

  const purchaseTypes = purchaseTypesQuery.data?.purchaseTypes ?? [];

  const createMutation = useMutation({
    mutationFn: async (values: MasterDataFormValues) => {
      const res = await fetch("/api/org-admin/purchase-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to create purchase type");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASE_TYPES_QUERY_KEY });
      toast.success("Purchase type created");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; values: MasterDataFormValues }) => {
      const res = await fetch(`/api/org-admin/purchase-types/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to update purchase type");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASE_TYPES_QUERY_KEY });
      toast.success("Purchase type updated");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (args: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/org-admin/purchase-types/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: args.isActive }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          payload.error || "Failed to update purchase type status"
        );
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASE_TYPES_QUERY_KEY });
      toast.success("Status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateDialog() {
    setSelected(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEditDialog(purchaseType: PurchaseType) {
    setSelected(purchaseType);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  async function handleSubmit(values: MasterDataFormValues) {
    if (dialogMode === "create") {
      await createMutation.mutateAsync(values);
      return;
    }

    if (!selected) throw new Error("No purchase type selected");
    await updateMutation.mutateAsync({ id: selected.id, values });
  }

  const columns = useMemo<ColumnDef<PurchaseType>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => (
          <div className="font-medium tabular-nums">{row.original.label}</div>
        ),
      },
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.code}</div>
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
          const purchaseType = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(purchaseType)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {purchaseType.isActive ? (
                  <DropdownMenuItem
                    onClick={() =>
                      toggleMutation.mutate({
                        id: purchaseType.id,
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
                        id: purchaseType.id,
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
    [toggleMutation]
  );

  const table = useReactTable({
    data: purchaseTypes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  if (purchaseTypesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <Input
          placeholder="Filter purchase types..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full sm:max-w-sm"
        />
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Purchase Type
        </Button>
      </div>

      {purchaseTypesQuery.isError ? (
        <div className="rounded-md border p-4 text-sm text-destructive">
          {(purchaseTypesQuery.error as Error).message}
        </div>
      ) : (
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
                    No purchase types found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <MasterDataDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        entityLabel="Purchase Type"
        defaultValues={
          selected ? { label: selected.label, code: selected.code } : undefined
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
