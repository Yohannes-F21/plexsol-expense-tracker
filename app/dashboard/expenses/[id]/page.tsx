"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

export default function StaffExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load expense");
      return payload as { expense: any };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error)
    return <div className="text-destructive">{(error as Error).message}</div>;

  const expense = data?.expense;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Receipt</h1>
          <p className="text-sm text-muted-foreground">
            Read-only receipt view.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/expenses">Back</Link>
          </Button>
          <Button asChild disabled={expense.status === "APPROVED"}>
            <Link href={`/dashboard/expenses/${expense.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-center md:text-left">
                Cash Sales Attachment
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Receipt #{expense.id.slice(0, 8)}
              </div>
            </div>
            <Badge
              variant={
                expense.status === "WARNING"
                  ? "outline"
                  : expense.status === "APPROVED"
                  ? "default"
                  : expense.status === "REJECTED"
                  ? "destructive"
                  : "secondary"
              }
            >
              {expense.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm font-medium">From</div>
              <Separator className="my-3" />
              <div className="grid gap-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Company</span>
                  <span className="text-right font-medium">
                    {expense.companyName}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Supplier TIN</span>
                  <span className="text-right font-mono text-xs">
                    {expense.tinNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm font-medium">Details</div>
              <Separator className="my-3" />
              <div className="grid gap-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-right">
                    {new Date(expense.purchasedDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">FS No.</span>
                  <span className="text-right font-mono text-xs">
                    {expense.fsNumber}
                  </span>
                </div>
                {expense.invoiceNumber ? (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Invoice No.</span>
                    <span className="text-right font-mono text-xs">
                      {expense.invoiceNumber}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-right">
                    {String(expense.paymentMethod).replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-14">No</TableHead>
                  <TableHead className="w-1/5">Description</TableHead>
                  <TableHead className="w-1/5 text-right">Quantity</TableHead>
                  <TableHead className="w-1/5 text-right">Unit Price</TableHead>
                  <TableHead className="w-1/5 text-right">
                    Total Price
                  </TableHead>
                  <TableHead className="w-1/5">Policy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expense.items.map((it: any, index: number) => (
                  <TableRow key={it.id} className="bg-muted/10">
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{it.itemName}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.subcategory?.name ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(it.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(it.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(it.lineTotal)}
                    </TableCell>
                    <TableCell>
                      {it.hasPolicyViolation ? (
                        <Badge variant="outline">Warning</Badge>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-sm rounded-lg border bg-background">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground">
                      SubTotal
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(expense.subtotal)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground">
                      VAT
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(expense.vat)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/20">
                    <TableCell className="text-sm font-medium">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(expense.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
