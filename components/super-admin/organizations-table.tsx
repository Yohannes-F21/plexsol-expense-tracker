"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  console.log("Organizations:", organizations);

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/super-admin/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      toast.success("Organization deactivated successfully");
    },
    onError: () => {
      toast.error("Failed to deactivate organization");
    },
  });

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
        const isActive = row.getValue("isActive") as boolean;
        return (
          <Badge
            className={`${
              isActive
                ? "bg-green-100 text-green-900"
                : "bg-red-100 text-red-900"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </Badge>
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
      id: "actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrgId(org.id);
                  setShowInviteDialog(true);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Invite Admin
              </DropdownMenuItem>
              {org.isActive && (
                <DropdownMenuItem
                  onClick={() => deactivateMutation.mutate(org.id)}
                  variant="destructive"
                  className="text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  if (isLoading) {
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
          placeholder="Filter organizations..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
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
                  No organizations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <InviteOrgAdminDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        organizationId={selectedOrgId}
      />
    </div>
  );
}
