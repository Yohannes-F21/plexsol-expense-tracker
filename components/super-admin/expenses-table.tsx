"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
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

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  organization: { id: string; name: string } | null;
  user: { id: string; name: string | null; email: string };
  category: { id: string; name: string } | null;
};

export function ExpensesTable() {
  const [organizationId, setOrganizationId] = useState<string | undefined>(
    undefined
  );
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 20;

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
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (status) params.set("status", status);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await apiClient<{ total: number; expenses: Expense[] }>(
        `/api/super-admin/expenses?${params.toString()}`
      );
      return res;
    },
    // keepPreviousData omitted to satisfy project react-query typings
  });

  const expenses: Expense[] = data?.expenses || [];
  const total = data?.total || 0;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Organization ID"
          value={organizationId || ""}
          onChange={(e) => setOrganizationId(e.target.value || undefined)}
        />
        <Select onValueChange={(v) => setStatus(v === "ALL" ? undefined : v)}>
          <SelectTrigger className="w-40">
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
            setPage(1);
          }}
        >
          Apply
        </Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No expenses found
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Expense ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.id}</TableCell>
                  <TableCell>{e.organization?.name || "-"}</TableCell>
                  <TableCell>{e.user.name || e.user.email}</TableCell>
                  <TableCell>{e.category?.name || "-"}</TableCell>
                  <TableCell>{e.amount}</TableCell>
                  <TableCell>{e.currency}</TableCell>
                  <TableCell>{e.status}</TableCell>
                  <TableCell>
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <div>
              Showing {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, total)} of {total}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
