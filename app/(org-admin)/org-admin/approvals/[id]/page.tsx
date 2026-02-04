"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Loader } from "@/components/loader";

type ApprovalAction = "APPROVED" | "REJECTED";

type ApprovalHistoryRow = {
  id: string;
  action: ApprovalAction;
  comment: string | null;
  createdAt: string;
  performedBy: { id: string; name: string | null; email: string };
};

type BaseExpenseDetail = {
  id: string;
  expenseType: "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL";
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string } | null;
  approvalHistory: ApprovalHistoryRow[];
};

type ReceiptExpenseDetail = BaseExpenseDetail & {
  expenseType: "RECEIPT";
  purchasedDate: string;
  companyName: string;
  tinNumber: string;
  fsNumber: string;
  invoiceNumber: string | null;
  paymentMethod: string;
  checkNumber: string | null;
  bankAccountId: string | null;
  bankAccount: {
    id: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    isActive: boolean;
  } | null;
  subtotal: any;
  vat: any;
  total: any;
  items: Array<{
    id: string;
    itemName: string;
    quantity: any;
    unitPrice: any;
    lineTotal: any;
    hasPolicyViolation: boolean;
    subcategory: { id: string; name: string; type: string } | null;
  }>;
};

type PaymentVoucherDetail = BaseExpenseDetail & {
  expenseType: "PAYMENT_VOUCHER";
  purchasedDate: string;
  paidTo: string;
  tinNumber: string | null;
  invoiceNumber: string;
  paymentMethod: string;
  checkNumber: string | null;
  bankAccountId: string | null;
  bankAccount: {
    id: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    isActive: boolean;
  } | null;
  totalAmount: any;
  items: Array<{
    id: string;
    itemName: string;
    quantity: any;
    unitPrice: any;
    lineTotal: any;
    category?: { id: string; name: string } | null;
  }>;
};

type GeneralExpenseDetail = BaseExpenseDetail & {
  expenseType: "GENERAL";
  paymentDate: string;
  paidTo: string;
  description: string;
  amount: any;
  paymentMethod: string;
  checkNumber: string | null;
  bankAccountId: string | null;
  bankAccount: {
    id: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    isActive: boolean;
  } | null;
  category?: { id: string; name: string; type?: string } | null;
};

type ExpenseDetail =
  | ReceiptExpenseDetail
  | PaymentVoucherDetail
  | GeneralExpenseDetail;

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

export default function OrgAdminApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["approval", id],
    queryFn: async () => {
      return apiClient<{ expense: ExpenseDetail }>(
        `/api/org-admin/approvals/${id}`,
      );
    },
  });

  const expense = data?.expense;

  const canTakeAction =
    expense?.status === "PENDING" || expense?.status === "WARNING";

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiClient(`/api/org-admin/expenses/${id}/approve`, {
        method: "POST",
      });
    },
    onSuccess: async () => {
      toast.success("Expense approved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["approval", id] }),
        queryClient.invalidateQueries({ queryKey: ["expense", id] }),
      ]);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiClient(`/api/org-admin/expenses/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment: rejectComment }),
      });
    },
    onSuccess: async () => {
      toast.success("Expense rejected");
      setRejectOpen(false);
      setRejectComment("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["approval", id] }),
        queryClient.invalidateQueries({ queryKey: ["expense", id] }),
      ]);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    },
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader size="md" ariaLabel="Loading Expense" showLabel />
      </div>
    );
  if (error)
    return <div className="text-destructive">{(error as Error).message}</div>;
  if (!expense)
    return <div className="text-destructive">Expense not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <BackButton href="/org-admin/approvals" />
        <div className="pt-0.5">
          <h1 className="text-2xl font-semibold">Approval</h1>
          <p className="text-sm text-muted-foreground">
            Review expense details and take action.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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
                      <span className="text-muted-foreground">
                        Supplier TIN
                      </span>
                      <span className="text-right font-mono text-xs">
                        {expense.tinNumber}
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
                        <span className="text-muted-foreground">
                          Invoice No.
                        </span>
                        <span className="text-right font-mono text-xs">
                          {expense.invoiceNumber}
                        </span>
                      </div>
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
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Payment</span>
                      <span className="text-right">
                        {String(expense.paymentMethod).replace(/_/g, " ")}
                      </span>
                    </div>
                    {expense.paymentMethod === "CHECK" &&
                    expense.checkNumber ? (
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">Check No.</span>
                        <span className="text-right font-mono text-xs">
                          {expense.checkNumber}
                        </span>
                      </div>
                    ) : null}
                    {expense.paymentMethod === "BANK_TRANSFER" &&
                    expense.bankAccountId ? (
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
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
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
                      <TableHead className="w-[16%]">Policy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expense.items.map((it, index) => (
                      <TableRow key={it.id} className="bg-muted/10">
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <div className="font-medium truncate">
                            {it.itemName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {it.subcategory?.name ?? "-"}
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
                      <TableRow className="bg-muted/70">
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
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
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
                    {expense.items.map((it, index) => (
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
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="text-right font-mono text-xs">
                        {expense.createdByUser?.email ?? "-"}
                      </span>
                    </div>
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

        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{expense.status}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-right">
                  {new Date(expense.createdAt).toLocaleString()}
                </span>
              </div>
              {expense.approvedAt ? (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Approved at</span>
                  <span className="text-right">
                    {new Date(expense.approvedAt).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Button
                onClick={() => setApproveOpen(true)}
                disabled={
                  !canTakeAction ||
                  approveMutation.isPending ||
                  rejectMutation.isPending
                }
              >
                {approveMutation.isPending ? "Approving..." : "Approve"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                disabled={
                  !canTakeAction ||
                  approveMutation.isPending ||
                  rejectMutation.isPending
                }
              >
                Reject
              </Button>
            </div>

            {!canTakeAction ? (
              <p className="text-xs text-muted-foreground">
                This expense is finalized and can’t be changed.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Policy warnings are informational and do not block approval.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={approveOpen}
        onOpenChange={(o) => {
          if (approveMutation.isPending) return;
          setApproveOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              Approved expenses become immutable. This action will be recorded
              in the approval history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending || !canTakeAction}
              onClick={async () => {
                await approveMutation.mutateAsync();
                setApproveOpen(false);
              }}
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          if (rejectMutation.isPending) return;
          setRejectOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this expense?</DialogTitle>
            <DialogDescription>
              Rejection comment is optional. This action will be recorded in the
              approval history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">Comment (optional)</div>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Add a reason for rejection..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                await rejectMutation.mutateAsync();
              }}
              disabled={!canTakeAction || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
