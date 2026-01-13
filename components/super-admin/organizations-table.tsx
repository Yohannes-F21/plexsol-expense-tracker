"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { apiClient } from "@/lib/api-client";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreHorizontal,
  Plus,
  Mail,
  ArrowUpDown,
  Tag,
  Trash,
} from "lucide-react";
import { CreateOrganizationDialog } from "@/components/create-organization-dialog";
import { InviteOrgAdminDialog } from "@/components/invite-org-admin-dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table-pagination";

interface Organization {
  id: string;
  name: string;
  industry?: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    users: number;
    expenses: number;
  };
}

export function OrganizationsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const queryClient = useQueryClient();

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const data = await apiClient<Organization[]>(
        "/api/super-admin/organizations"
      );
      console.log("Organizations fetched:", data.length);
      return data;
    },
  });

  const toggleOrgActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient(`/api/super-admin/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      toast.success("Organization status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update organization status");
    },
  });

  const OrgActiveSwitch = ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    disabled?: boolean;
  }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={
          "relative inline-flex h-6 w-22 items-center rounded-full border px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
          (checked ? "bg-green-400" : "bg-red-400")
        }
      >
        <span
          className={
            "absolute inset-0 flex items-center justify-center text-[11px] font-medium leading-none " +
            (checked ? "text-primary-foreground" : "text-primary-foreground")
          }
        >
          {checked ? "Active" : "Blocked"}
        </span>
        <span
          className={
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow-xs transition-all " +
            (checked ? "right-0.5" : "left-0.5")
          }
        />
      </button>
    );
  };

  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3"
        >
          Organization Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => <div>{row.getValue("industry") || "N/A"}</div>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const org = row.original;
        const isActive = row.getValue("isActive") as boolean;
        return (
          <OrgActiveSwitch
            checked={isActive}
            disabled={toggleOrgActiveMutation.isPending}
            onCheckedChange={(next) =>
              toggleOrgActiveMutation.mutate({ id: org.id, isActive: next })
            }
          />
        );
      },
    },
    {
      accessorKey: "_count.users",
      header: "Users",
      cell: ({ row }) => <div>{row.original._count.users}</div>,
    },
    {
      accessorKey: "_count.expenses",
      header: "Expenses",
      cell: ({ row }) => <div>{row.original._count.expenses}</div>,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return <div>{date.toLocaleDateString()}</div>;
      },
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className=""
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setShowInviteDialog(true);
                  }}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Invite Admin</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: organizations,
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
  }, [columnFilters, sorting]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <Input
              placeholder="Search..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="w-full sm:max-w-sm"
            />
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
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
                      No organizations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            table={table}
            storageKey="super-admin-organizations-page-size"
          />
        </CardContent>
      </Card>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <InviteOrgAdminDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        organizationId={selectedOrgId}
      />
    </TooltipProvider>
  );
}
