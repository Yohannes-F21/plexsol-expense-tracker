"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  MasterDataDialog,
  type MasterDataFormValues,
} from "@/components/org-admin/master-data-dialog";

type Unit = {
  id: string;
  label: number;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const UNITS_QUERY_KEY = ["org-admin-units-of-measure"] as const;

export function UnitsOfMeasureManagement() {
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Unit | null>(null);

  const unitsQuery = useQuery<{ units: Unit[] }>({
    queryKey: UNITS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/org-admin/units-of-measure", {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load units");
      return payload as { units: Unit[] };
    },
  });

  const units = unitsQuery.data?.units ?? [];

  const createMutation = useMutation({
    mutationFn: async (values: MasterDataFormValues) => {
      const res = await fetch("/api/org-admin/units-of-measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to create unit");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_QUERY_KEY });
      toast.success("Unit created");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; values: MasterDataFormValues }) => {
      const res = await fetch(`/api/org-admin/units-of-measure/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.values),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to update unit");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_QUERY_KEY });
      toast.success("Unit updated");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (args: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/org-admin/units-of-measure/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: args.isActive }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.error || "Failed to update unit status");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_QUERY_KEY });
      toast.success("Status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateDialog() {
    setSelected(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEditDialog(unit: Unit) {
    setSelected(unit);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  async function handleSubmit(values: MasterDataFormValues) {
    if (dialogMode === "create") {
      await createMutation.mutateAsync(values);
      return;
    }

    if (!selected) throw new Error("No unit selected");
    await updateMutation.mutateAsync({ id: selected.id, values });
  }

  const columns = useMemo<ColumnDef<Unit>[]>(
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
          const unit = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(unit)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {unit.isActive ? (
                  <DropdownMenuItem
                    onClick={() =>
                      toggleMutation.mutate({ id: unit.id, isActive: false })
                    }
                    className="text-destructive"
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      toggleMutation.mutate({ id: unit.id, isActive: true })
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
    data: units,
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

  if (unitsQuery.isLoading) {
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
          placeholder="Filter units..."
          value={(table.getColumn("code")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("code")?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Unit
        </Button>
      </div>

      {unitsQuery.isError ? (
        <div className="rounded-md border p-4 text-sm text-destructive">
          {(unitsQuery.error as Error).message}
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
                    No units found.
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
        entityLabel="Unit"
        defaultValues={
          selected ? { label: selected.label, code: selected.code } : undefined
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
