"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/data-table-pagination";

const REPORT_HEADERS = [
  "VAT Category",
  "Calendar Type",
  "Types of Purchase",
  "TIN",
  "Seller",
  "Date of Purchase",
  "MRC Number",
  "VAT Receipt Number",
  "Description",
  "Unit of Measure",
  "Quantity",
  "Unit Price",
  "Total Value",
  "VAT",
  "Value After VAT",
] as const;

type ReportHeader = (typeof REPORT_HEADERS)[number];
export type ReportRow = Record<ReportHeader, string | number>;

function toCsv(rows: ReportRow[]): string {
  const escape = (value: string | number | null | undefined) => {
    const s = String(value ?? "");
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines: string[] = [];
  lines.push(REPORT_HEADERS.map((h) => escape(h)).join(","));
  for (const row of rows) {
    lines.push(REPORT_HEADERS.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\r\n");
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [appliedRange, setAppliedRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Avoid expensive refetches while the user is interacting with date pickers.
  // Only apply filtering once both dates are selected (debounced).
  useEffect(() => {
    const hasBoth = Boolean(from && to);

    if (!hasBoth) {
      if (appliedRange !== null) setAppliedRange(null);
      return;
    }

    if (appliedRange?.from === from && appliedRange?.to === to) return;

    const t = setTimeout(() => {
      setAppliedRange({ from, to });
    }, 250);

    return () => clearTimeout(t);
  }, [from, to, appliedRange]);

  const rangeKey = useMemo(() => {
    return appliedRange ? `${appliedRange.from}__${appliedRange.to}` : "all";
  }, [appliedRange]);

  const queryString = useMemo(() => {
    if (!appliedRange) return "";
    const params = new URLSearchParams({
      from: appliedRange.from,
      to: appliedRange.to,
    });
    return `?${params.toString()}`;
  }, [appliedRange]);

  const { data, isLoading } = useQuery<{ rows: ReportRow[] }>({
    queryKey: ["org-admin-reports", rangeKey],
    queryFn: () =>
      apiClient<{ rows: ReportRow[] }>(`/api/org-admin/reports${queryString}`),
  });

  const rows = data?.rows ?? [];

  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () =>
      REPORT_HEADERS.map((h) => ({
        id: h,
        header: h,
        accessorFn: (row) => row[h],
        cell: ({ getValue }) => {
          const v = getValue();
          return <span className="whitespace-nowrap">{String(v ?? "")}</span>;
        },
      })),
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
  }, [rangeKey, sorting, columnFilters]);

  const handleDownload = async () => {
    if (!from || !to) {
      toast.error("Please select date range before downloading");
      return;
    }

    try {
      const params = new URLSearchParams({ from, to });
      const result = await apiClient<{ rows: ReportRow[] }>(
        `/api/org-admin/reports?${params.toString()}`
      );
      const csv = toCsv(result.rows ?? []);
      downloadTextFile(
        `reports_${from}_to_${to}.csv`,
        csv,
        "text/csv;charset=utf-8;"
      );
    } catch (e) {
      console.error("[v0] Download CSV error:", e);
      toast.error("Failed to download CSV");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Download expense item reports
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">From date</div>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">To date</div>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-start md:justify-end">
              <Button onClick={handleDownload}>Download CSV</Button>
            </div>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={REPORT_HEADERS.length}>
                      <div className="py-6">
                        <Skeleton className="h-6 w-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
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
                      className="h-24 text-center text-muted-foreground"
                    >
                      No data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <DataTablePagination
              table={table}
              storageKey="org-admin-reports-page-size"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
