"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServerDataTablePagination } from "@/components/data-table-pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type HistoryRow = {
  id: string;
  action: "APPROVED" | "REJECTED";
  comment: string | null;
  createdAt: string;
  performedBy: { id: string; name: string | null; email: string };
  expense: {
    id: string;
    expenseType: "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL";
    vendorPayee: string;
    total: any;
    createdAt: string;
    createdByUser: { id: string; name: string | null; email: string } | null;
  };
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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatIsoDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function RejectionReasonPopover({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs text-destructive underline underline-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          View reason
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        className="w-80"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-1">
          <div className="text-sm font-medium">Rejection reason</div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {reason}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ApprovalsHistory() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["approvals-history"],
    queryFn: async () => {
      return apiClient<{ history: HistoryRow[] }>(
        "/api/org-admin/approvals/history",
      );
    },
  });

  const history = data?.history ?? [];

  useEffect(() => {
    setPageIndex(0);
  }, [history.length]);

  const paged = useMemo(() => {
    const start = pageIndex * pageSize;
    return history.slice(start, start + pageSize);
  }, [history, pageIndex, pageSize]);

  if (error) {
    return <div className="text-destructive">{(error as Error).message}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval History</CardTitle>
        <div className="text-sm text-muted-foreground">
          Recently processed expense approvals
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vendor/Payee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center justify-center py-8">
                      <Loader
                        size="md"
                        ariaLabel="Loading approval history"
                        showLabel
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No approval history yet.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div className="font-medium">
                        {h.expense.createdByUser?.name || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.expense.createdByUser?.email || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {h.expense.expenseType === "PAYMENT_VOUCHER"
                          ? "Payment Voucher"
                          : h.expense.expenseType === "GENERAL"
                            ? "General"
                            : "Receipt"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {h.expense.vendorPayee || "-"}
                    </TableCell>
                    <TableCell className="font-semibold font-mono tabular-nums">
                      {formatMoney(h.expense.total)}
                      <span className="ml-1">ETB</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 ">
                        <Badge
                          variant="outline"
                          className={
                            h.action === "APPROVED"
                              ? "text-green-600 bg-green-100 font-semibold"
                              : "text-red-600 bg-red-100 font-semibold"
                          }
                        >
                          {h.action === "APPROVED" ? "Approved" : "Rejected"}
                        </Badge>
                        <div>
                          {h.action === "REJECTED" && h.comment ? (
                            <RejectionReasonPopover reason={h.comment} />
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {h.performedBy.name || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.performedBy.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatIsoDate(h.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4">
          <ServerDataTablePagination
            totalCount={history.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
            storageKey="org-admin-approvals-history-page-size"
          />
        </div>
      </CardContent>
    </Card>
  );
}
