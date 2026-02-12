"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
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
import { ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ServerDataTablePagination } from "@/components/data-table-pagination";
import { Switch } from "@/components/ui/switch";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  organization: {
    id: string;
    name: string;
  } | null;
  _count: {
    expenseBases: number;
  };
  createdAt: string;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

type UsersResponse = {
  total: number;
  users: User[];
  page: number;
  pageSize: number;
};

export function UsersTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const debouncedSearch = useDebouncedValue(searchTerm, 250);

  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<UsersResponse>({
    queryKey: [
      "super-admin-users",
      organizationFilter,
      statusFilter,
      debouncedSearch,
      pageIndex,
      pageSize,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (organizationFilter !== "all") {
        params.set("organizationId", organizationFilter);
      }
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "banned") params.set("isActive", "false");
      const q = debouncedSearch.trim();
      if (q) params.set("q", q);

      params.set("page", String(pageIndex + 1));
      params.set("pageSize", String(pageSize));

      const qs = params.toString();
      const url = qs
        ? `/api/super-admin/users?${qs}`
        : "/api/super-admin/users";
      return apiClient<UsersResponse>(url);
    },
    placeholderData: (previous) => previous,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const { data: organizations = [] } = useQuery<
    Array<{ id: string; name: string }>
  >({
    queryKey: ["organizations-options"],
    queryFn: () =>
      apiClient<Array<{ id: string; name: string }>>(
        "/api/super-admin/organizations/options",
      ),
    staleTime: 60_000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient(`/api/super-admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      toast.success("User status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update user status");
    },
  });

  const UserActiveSwitch = ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    disabled?: boolean;
  }) => {
    return (
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label="Toggle user status"
        className="data-[state=unchecked]:bg-destructive dark:data-[state=unchecked]:bg-destructive"
      />
    );
  };

  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <div>{row.getValue("email")}</div>,
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.getValue("role") as string;
          return <Badge variant="outline">{role.replace("_", " ")}</Badge>;
        },
      },
      {
        accessorKey: "organization",
        header: "Organization",
        cell: ({ row }) => {
          const org = row.original.organization;
          return <div>{org?.name || "N/A"}</div>;
        },
      },
      {
        accessorKey: "_count.expenseBases",
        header: "Expenses",
        cell: ({ row }) => <div>{row.original._count.expenseBases}</div>,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => {
          const user = row.original;
          const isActive = row.getValue("isActive") as boolean;
          return (
            <UserActiveSwitch
              checked={isActive}
              disabled={toggleActiveMutation.isPending}
              onCheckedChange={(next) =>
                toggleActiveMutation.mutate({ id: user.id, isActive: next })
              }
            />
          );
        },
      },
    ],
    [toggleActiveMutation.isPending],
  );

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  useEffect(() => {
    setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, organizationFilter, statusFilter, debouncedSearch]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full sm:max-w-sm"
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={organizationFilter}
              onValueChange={setOrganizationFilter}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org: any) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
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
                  <TableCell colSpan={columns.length}>
                    <div className="flex items-center justify-center py-8">
                      <Loader size="md" ariaLabel="Loading users" showLabel />
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
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <ServerDataTablePagination
          totalCount={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          storageKey="super-admin-users-page-size"
        />

        {isFetching ? (
          <div className="text-xs text-muted-foreground">Refreshing…</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
