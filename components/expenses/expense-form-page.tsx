"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ReceiptExpenseForm,
  type ReceiptExpenseDetail,
} from "@/components/expenses/receipt-expense-form";
import {
  PaymentVoucherForm,
  type PaymentVoucherDetail,
} from "@/components/expenses/payment-voucher-form";
import {
  GeneralExpenseForm,
  type GeneralExpenseDetail,
} from "@/components/expenses/general-expense-form";
import { canEditExpense } from "@/lib/expense-permissions";
import { BackButton } from "@/components/back-button";
import { Loader } from "@/components/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ExpenseFormPage(props: {
  role: "STAFF" | "ORG_ADMIN";
  mode: "create" | "edit";
  expenseId?: string;
  backHref: string;
  initialType?: "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL";
}) {
  const id = props.expenseId ?? null;
  const [expenseType, setExpenseType] = useState<
    "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL"
  >(props.initialType ?? "RECEIPT");

  const query = useQuery({
    queryKey: ["expense", id],
    enabled: props.mode === "edit" && Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${id}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load expense");
      return payload as {
        expense:
          | ReceiptExpenseDetail
          | PaymentVoucherDetail
          | GeneralExpenseDetail;
      };
    },
  });

  useEffect(() => {
    if (props.mode === "edit" && query.data?.expense) {
      const type = (query.data.expense as any).expenseType as
        | "RECEIPT"
        | "PAYMENT_VOUCHER"
        | "GENERAL"
        | undefined;
      if (type) setExpenseType(type);
    }
  }, [props.mode, query.data]);

  if (props.mode === "edit") {
    if (query.isLoading)
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader size="md" ariaLabel="Loading Expense Form" showLabel />
        </div>
      );
    if (query.error)
      return (
        <div className="text-destructive">{(query.error as Error).message}</div>
      );

    const expense = query.data?.expense as
      | ReceiptExpenseDetail
      | PaymentVoucherDetail
      | GeneralExpenseDetail
      | undefined;
    if (
      expense &&
      !canEditExpense({ role: props.role, status: expense.status })
    ) {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <BackButton href={props.backHref} />
            <div className="pt-0.5">
              <h1 className="text-2xl font-semibold">Edit Expense</h1>
              <p className="text-sm text-muted-foreground">
                This expense can’t be edited.
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  const headerDescription = (() => {
    if (expenseType === "PAYMENT_VOUCHER") {
      return props.mode === "create"
        ? "Submit a payment voucher with item lines."
        : "Update voucher info and items.";
    }
    if (expenseType === "GENERAL") {
      return props.mode === "create"
        ? "Submit a general expense payment."
        : "Update general expense info.";
    }
    return props.mode === "create"
      ? "Submit a receipt with item lines."
      : "Update receipt info and items.";
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-start gap-4">
          <BackButton href={props.backHref} />
          <div className="pt-0.5">
            <h1 className="text-2xl font-semibold">
              {props.mode === "create" ? "New Expense" : "Edit Expense"}
            </h1>
            <p className="text-sm text-muted-foreground">{headerDescription}</p>
          </div>
        </div>
        {props.mode === "create" ? (
          <div>
            <Select
              value={expenseType}
              onValueChange={(value) =>
                setExpenseType(
                  value as "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL",
                )
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder="Select expense type"
                  className="font-semibold text-primary"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEIPT">Receipt</SelectItem>
                <SelectItem value="PAYMENT_VOUCHER">Payment Voucher</SelectItem>
                <SelectItem value="GENERAL">General Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {expenseType === "RECEIPT" ? (
        <ReceiptExpenseForm
          mode={props.mode}
          role={props.role}
          expenseId={id ?? undefined}
          initial={
            props.mode === "edit"
              ? ((query.data?.expense as ReceiptExpenseDetail) ?? null)
              : undefined
          }
        />
      ) : expenseType === "PAYMENT_VOUCHER" ? (
        <PaymentVoucherForm
          mode={props.mode}
          role={props.role}
          expenseId={id ?? undefined}
          initial={
            props.mode === "edit"
              ? ((query.data?.expense as PaymentVoucherDetail) ?? null)
              : undefined
          }
        />
      ) : (
        <GeneralExpenseForm
          mode={props.mode}
          role={props.role}
          expenseId={id ?? undefined}
          initial={
            props.mode === "edit"
              ? ((query.data?.expense as GeneralExpenseDetail) ?? null)
              : undefined
          }
        />
      )}
    </div>
  );
}
