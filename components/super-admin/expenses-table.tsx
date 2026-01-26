"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader } from "@/components/loader";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ServerDataTablePagination } from "@/components/data-table-pagination";

type Expense = {
  id: string;
  status: string;
  createdAt: string;
  purchasedDate: string;
  organization: { id: string; name: string } | null;
  createdByUser: { id: string; name: string | null; email: string };
  companyName: string;
  total: any;
};

function renderStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className="text-yellow-600 bg-orange-100 font-semibold"
        >
          Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge
          variant="outline"
          className="text-green-600 bg-green-100 font-semibold"
        >
          Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge
          variant="outline"
          className="text-red-600 bg-red-100 font-semibold"
        >
          Rejected
        </Badge>
      );
    case "WARNING":
      return (
        <Badge
          variant="outline"
          className="text-orange-600 bg-orange-100 font-semibold"
        >
          Warning
        </Badge>
      );
    default:
      return status ? (
        <Badge variant="outline" className="text-muted-foreground">
          {status}
        </Badge>
      ) : (
        "-"
      );
  }
}

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
}

function formatMoney(x: any) {
  const n = asNumber(x);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

export function ExpensesTable() {
  const [organizationId, setOrganizationId] = useState<string | undefined>(
    undefined
  );
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery<
    { total: number; expenses: Expense[] },
    Error,
    { total: number; expenses: Expense[] }
  >({
    queryKey: [
      "super-admin-expenses",
      organizationId,
      status,
      start,
      end,
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (status) params.set("status", status);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      params.set("page", String(pageIndex + 1));
      params.set("pageSize", String(pageSize));

      const res = await apiClient<{ total: number; expenses: Expense[] }>(
        `/api/super-admin/expenses?${params.toString()}`
      );
      return res;
    },
  });

  const expenses: Expense[] = data?.expenses || [];
  const total = data?.total || 0;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-2">
          <Input
            placeholder="Organization ID"
            value={organizationId || ""}
            onChange={(e) => setOrganizationId(e.target.value || undefined)}
          />
          <Select onValueChange={(v) => setStatus(v === "ALL" ? undefined : v)}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={start || ""}
            onChange={(e) => setStart(e.target.value || undefined)}
          />
          <Input
            type="date"
            value={end || ""}
            onChange={(e) => setEnd(e.target.value || undefined)}
          />
          <Button
            onClick={() => {
              setPageIndex(0);
            }}
          >
            Apply
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader size="md" ariaLabel="Loading expenses" showLabel />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No expenses found
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Purchased Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.organization?.name || "-"}</TableCell>
                      <TableCell>
                        {e.createdByUser?.name || e.createdByUser?.email || "-"}
                      </TableCell>
                      <TableCell>{e.companyName}</TableCell>
                      <TableCell>
                        {new Date(e.purchasedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right  font-mono text-sm font-semibold ">
                        {formatMoney(e.total)}
                        <span className="ml-1">ETB</span>
                      </TableCell>
                      <TableCell>{renderStatusBadge(e.status)}</TableCell>
                      <TableCell>
                        {new Date(e.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
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
              storageKey="super-admin-expenses-page-size"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
