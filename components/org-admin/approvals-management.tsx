"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Eye, Move, MoveRight } from "lucide-react";
import { ServerDataTablePagination } from "@/components/data-table-pagination";

type ApprovalRow = {
  id: string;
  purchasedDate: string;
  companyName: string;
  tinNumber: string;
  fsNumber: string;
  total: any;
  status: "PENDING" | "WARNING";
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function") {
    return x.toNumber();
  }
  return Number(x);
}

function formatMoney(x: any) {
  const n = asNumber(x);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

export function ApprovalsManagement() {
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      return apiClient<{ approvals: ApprovalRow[] }>(
        "/api/org-admin/approvals"
      );
    },
  });

  const approvals = data?.approvals ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return approvals;

    return approvals.filter((a) => {
      const employeeName = a.createdByUser?.name ?? "";
      const employeeEmail = a.createdByUser?.email ?? "";
      return (
        a.companyName.toLowerCase().includes(q) ||
        employeeName.toLowerCase().includes(q) ||
        employeeEmail.toLowerCase().includes(q)
      );
    });
  }, [approvals, query]);

  useEffect(() => {
    setPageIndex(0);
  }, [query]);

  const paged = useMemo(() => {
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageIndex, pageSize]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading approvals...</div>;
  }

  if (error) {
    return <div className="text-destructive">{(error as Error).message}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending Approvals</CardTitle>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or employee..."
            className="pl-8 w-72"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>FS</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No expenses awaiting approval.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {row.createdByUser?.name || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.createdByUser?.email || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(row.purchasedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.companyName}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{row.fsNumber}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{row.tinNumber}</span>
                    </TableCell>
                    <TableCell className="font-semibold font-mono tabular-nums">
                      {formatMoney(row.total)}
                      <span className="ml-1">ETB</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "WARNING"
                            ? "text-orange-600 bg-orange-100 font-semibold"
                            : "text-yellow-600 bg-orange-100 font-semibold"
                        }
                      >
                        {row.status === "WARNING" ? "Warning" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/org-admin/approvals/${row.id}`}>
                          Approve <MoveRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4">
          <ServerDataTablePagination
            totalCount={filtered.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
            storageKey="org-admin-approvals-page-size"
          />
        </div>
      </CardContent>
    </Card>
  );
}
