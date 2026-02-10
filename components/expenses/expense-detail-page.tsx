"use client";

import Link from "next/link";
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
import { canEditExpense } from "@/lib/expense-permissions";
import { BackButton } from "@/components/back-button";
import { Loader } from "@/components/loader";

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const normalized = x.replace(/,/g, "").replace(/\s+/g, "");
    return Number(normalized);
  }
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
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

export function ExpenseDetailPage(props: {
  role: "STAFF" | "ORG_ADMIN";
  expenseId: string;
  backHref: string;
}) {
  const id = props.expenseId;
  const { data, isLoading, error } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load expense");
      return payload as { expense: any };
    },
  });

  if (isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader size="md" ariaLabel="Loading Expense Details" showLabel />
      </div>
    );
  if (error)
    return <div className="text-destructive">{(error as Error).message}</div>;

  const expense = data?.expense;
  if (!expense) {
    return <div className="text-destructive">Expense not found</div>;
  }

  const showEdit = canEditExpense({ role: props.role, status: expense.status });

  const typeLabel =
    expense.expenseType === "PAYMENT_VOUCHER"
      ? "Payment Voucher"
      : expense.expenseType === "GENERAL"
        ? "General Expense"
        : "Receipt";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <BackButton href={props.backHref} />
        <div className="flex w-full items-start justify-between gap-4">
          <div className="pt-0.5">
            <h1 className="text-2xl font-semibold">{typeLabel}</h1>
            <p className="text-sm text-muted-foreground">
              Read-only expense view.
            </p>
          </div>
          {showEdit ? (
            <Button asChild>
              <Link href={`/expenses/${expense.id}/edit`}>Edit</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {expense.expenseType === "RECEIPT" ? (
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

                  {props.role === "ORG_ADMIN" ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">FS No.</span>
                        <span className="text-right font-mono text-xs">
                          {expense.fsNumber}
                        </span>
                      </div>
                      {expense.mrcNumber ? (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">MRC No.</span>
                          <span className="text-right font-mono text-xs">
                            {expense.mrcNumber}
                          </span>
                        </div>
                      ) : null}
                      {expense.invoiceNumber ? (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">
                            Invoice No.
                          </span>
                          <span className="text-right font-mono text-xs">
                            {expense.invoiceNumber}
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : null}
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

                  {props.role === "STAFF" ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">FS No.</span>
                        <span className="text-right font-mono text-xs">
                          {expense.fsNumber}
                        </span>
                      </div>
                      {expense.mrcNumber ? (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">MRC No.</span>
                          <span className="text-right font-mono text-xs">
                            {expense.mrcNumber}
                          </span>
                        </div>
                      ) : null}
                      {expense.invoiceNumber ? (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">
                            Invoice No.
                          </span>
                          <span className="text-right font-mono text-xs">
                            {expense.invoiceNumber}
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="text-right">
                      {String(expense.paymentMethod).replace(/_/g, " ")}
                    </span>
                  </div>

                  {expense.paymentMethod === "CHECK" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Check No.</span>
                      <span className="text-right font-mono text-xs">
                        {expense.checkNumber ?? "-"}
                      </span>
                    </div>
                  ) : null}

                  {expense.paymentMethod === "BANK_TRANSFER" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">
                        Bank Account
                      </span>
                      <span className="text-right text-xs">
                        {expense.bankAccount
                          ? `${expense.bankAccount.bankName} — ${expense.bankAccount.accountHolderName} — ${expense.bankAccount.accountNumber}`
                          : (expense.bankAccountId ?? "-")}
                      </span>
                    </div>
                  ) : null}

                  {props.role === "ORG_ADMIN" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-275">
                <TableHeader>
                  <TableRow
                    className={
                      props.role === "STAFF" ? "bg-muted/30" : "bg-muted/70"
                    }
                  >
                    <TableHead
                      className={props.role === "STAFF" ? "w-14" : "w-14"}
                    >
                      No
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>VAT</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Purchase Type</TableHead>
                    <TableHead
                      className={
                        props.role === "STAFF" ? "text-right" : undefined
                      }
                    >
                      Quantity
                    </TableHead>
                    <TableHead
                      className={
                        props.role === "STAFF" ? "text-right" : undefined
                      }
                    >
                      Unit Price
                    </TableHead>
                    <TableHead
                      className={
                        props.role === "STAFF" ? "text-right" : undefined
                      }
                    >
                      Total Price
                    </TableHead>
                    <TableHead>Policy</TableHead>
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
                      <TableCell className=" text-xs">
                        {it.vatCategory
                          ? it.vatCategory === "G"
                            ? "GOOD"
                            : "SERVICE"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {it.unitOfMeasure?.code ?? "-"}
                      </TableCell>
                      <TableCell>{it.purchaseType?.label ?? "-"}</TableCell>
                      <TableCell
                        className={
                          props.role === "STAFF"
                            ? "text-right tabular-nums"
                            : undefined
                        }
                      >
                        {formatMoney(it.quantity)}
                      </TableCell>
                      <TableCell
                        className={
                          props.role === "STAFF"
                            ? "text-right tabular-nums"
                            : undefined
                        }
                      >
                        {formatMoney(it.unitPrice)}
                      </TableCell>
                      <TableCell
                        className={
                          props.role === "STAFF"
                            ? "text-right tabular-nums"
                            : undefined
                        }
                      >
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
                    <TableRow
                      className={
                        props.role === "STAFF" ? "bg-muted/20" : "bg-muted/70"
                      }
                    >
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
      ) : expense.expenseType === "PAYMENT_VOUCHER" ? (
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-center md:text-left">
                  Payment Voucher
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Voucher #{expense.id.slice(0, 8)}
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
                <div className="text-sm font-medium">Payee</div>
                <Separator className="my-3" />
                <div className="grid gap-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Paid to</span>
                    <span className="text-right font-medium">
                      {expense.paidTo}
                    </span>
                  </div>
                  {expense.tinNumber ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">TIN</span>
                      <span className="text-right font-mono text-xs">
                        {expense.tinNumber}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="text-right font-mono text-xs">
                      {expense.invoiceNumber}
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
                    <span className="text-muted-foreground">Payment</span>
                    <span className="text-right">
                      {String(expense.paymentMethod).replace(/_/g, " ")}
                    </span>
                  </div>

                  {expense.paymentMethod === "CHECK" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Check No.</span>
                      <span className="text-right font-mono text-xs">
                        {expense.checkNumber ?? "-"}
                      </span>
                    </div>
                  ) : null}

                  {expense.paymentMethod === "BANK_TRANSFER" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">
                        Bank Account
                      </span>
                      <span className="text-right text-xs">
                        {expense.bankAccount
                          ? `${expense.bankAccount.bankName} — ${expense.bankAccount.accountHolderName} — ${expense.bankAccount.accountNumber}`
                          : (expense.bankAccountId ?? "-")}
                      </span>
                    </div>
                  ) : null}

                  {props.role === "ORG_ADMIN" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/70">
                    <TableHead className="w-14">No</TableHead>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="w-[12%] text-right">
                      Quantity
                    </TableHead>
                    <TableHead className="w-[16%] text-right">
                      Unit Price
                    </TableHead>
                    <TableHead className="w-[16%] text-right">
                      Total Price
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expense.items.map((it: any, index: number) => (
                    <TableRow key={it.id} className="bg-muted/10">
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <div className="font-medium truncate">
                          {it.itemName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {it.category?.name ?? "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatMoney(it.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatMoney(it.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatMoney(it.lineTotal)}
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
                    <TableRow className="bg-muted/70">
                      <TableCell className="text-sm font-medium">
                        Total Amount
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(expense.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-center md:text-left">
                  General Expense
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Expense #{expense.id.slice(0, 8)}
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
                <div className="text-sm font-medium">Payee</div>
                <Separator className="my-3" />
                <div className="grid gap-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Paid to</span>
                    <span className="text-right font-medium">
                      {expense.paidTo}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-right">
                      {expense.category?.name ?? "-"}
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
                      {new Date(expense.paymentDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="text-right">
                      {String(expense.paymentMethod).replace(/_/g, " ")}
                    </span>
                  </div>

                  {expense.checkNumber ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Check No.</span>
                      <span className="text-right font-mono text-xs">
                        {expense.checkNumber}
                      </span>
                    </div>
                  ) : null}

                  {expense.bankAccountId ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">
                        Bank Account
                      </span>
                      <span className="text-right text-xs">
                        {expense.bankAccount
                          ? `${expense.bankAccount.bankName} — ${expense.bankAccount.accountHolderName} — ${expense.bankAccount.accountNumber}`
                          : expense.bankAccountId}
                      </span>
                    </div>
                  ) : null}

                  {props.role === "ORG_ADMIN" ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm font-medium">Description</div>
              <Separator className="my-3" />
              <p className="text-sm text-muted-foreground">
                {expense.description}
              </p>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-sm rounded-lg border bg-background">
                <Table>
                  <TableBody>
                    <TableRow className="bg-muted/70">
                      <TableCell className="text-sm font-medium">
                        Total Amount
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(expense.amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
