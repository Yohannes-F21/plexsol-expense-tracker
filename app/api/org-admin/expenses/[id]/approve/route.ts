import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const organizationId: string = session.organizationId;

    const expense = await prisma.expenseBase.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        status: true,
        expenseType: true,
        receiptExpense: {
          select: {
            bankAccountId: true,
            paymentMethod: true,
            total: true,
          },
        },
        paymentVoucherExpense: {
          select: {
            paymentMethod: true,
            totalAmount: true,
            bankAccountId: true,
            items: { select: { lineTotal: true } },
          },
        },
        generalExpense: {
          select: {
            paymentMethod: true,
            amount: true,
            bankAccountId: true,
          },
        },
      },
    });

    if (
      !expense ||
      expense.organizationId !== organizationId ||
      !expense.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Expense already finalized" },
        { status: 400 },
      );
    }

    let bankAccountId: string | null = null;
    let paymentMethod: string | null = null;
    let amountToDeduct = new Prisma.Decimal(0);

    if (expense.expenseType === "RECEIPT") {
      if (!expense.receiptExpense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 },
        );
      }

      bankAccountId = expense.receiptExpense.bankAccountId ?? null;
      paymentMethod = expense.receiptExpense.paymentMethod;
      amountToDeduct = new Prisma.Decimal(expense.receiptExpense.total ?? 0);
    } else if (expense.expenseType === "PAYMENT_VOUCHER") {
      if (!expense.paymentVoucherExpense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 },
        );
      }

      paymentMethod = expense.paymentVoucherExpense.paymentMethod;
      bankAccountId = expense.paymentVoucherExpense.bankAccountId ?? null;
      const itemTotal = expense.paymentVoucherExpense.items.reduce(
        (sum, item) => sum.plus(item.lineTotal ?? 0),
        new Prisma.Decimal(0),
      );
      amountToDeduct = itemTotal.gt(0)
        ? itemTotal
        : new Prisma.Decimal(expense.paymentVoucherExpense.totalAmount ?? 0);
    } else if (expense.expenseType === "GENERAL") {
      if (!expense.generalExpense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 },
        );
      }

      paymentMethod = expense.generalExpense.paymentMethod;
      bankAccountId = expense.generalExpense.bankAccountId ?? null;
      amountToDeduct = new Prisma.Decimal(expense.generalExpense.amount ?? 0);
    } else {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const shouldDeduct = paymentMethod === "BANK_TRANSFER";

    const updatedExpense = await prisma.$transaction(
      async (tx) => {
        const approvedAt = new Date();
        const approvalResult = await tx.expenseBase.updateMany({
          where: {
            id,
            organizationId,
            status: { in: ["PENDING", "WARNING"] },
            isActive: true,
          },
          data: { status: "APPROVED", approvedAt },
        });

        if (approvalResult.count === 0) {
          throw new Error("expense_already_finalized");
        }

        if (shouldDeduct) {
          if (!bankAccountId) {
            throw new Error("bank_account_not_found");
          }

          const bankAccount = await tx.bankAccount.findFirst({
            where: {
              id: bankAccountId,
              organizationId,
              isActive: true,
            },
            select: { id: true, balance: true },
          });

          if (!bankAccount) {
            throw new Error("bank_account_not_found");
          }

          if (bankAccount.balance.lt(amountToDeduct)) {
            throw new Error("insufficient_balance");
          }

          await tx.bankAccount.update({
            where: { id: bankAccount.id },
            data: { balance: { decrement: amountToDeduct } },
            select: { id: true },
          });
        }

        await tx.approvalHistory.create({
          data: {
            expenseBaseId: id,
            action: "APPROVED",
            comment: null,
            performedById: session.id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.id,
            organizationId,
            actionType: "EXPENSE_APPROVED",
            entityType: "Expense",
            entityId: id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return {
          id,
          status: "APPROVED",
          approvedAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error(" Approve expense error:", error);

    if (error instanceof Error) {
      if (error.message === "expense_already_finalized") {
        return NextResponse.json(
          { error: "Expense already finalized" },
          { status: 400 },
        );
      }

      if (error.message === "bank_account_not_found") {
        return NextResponse.json(
          { error: "Bank account not found or inactive" },
          { status: 404 },
        );
      }

      if (error.message === "insufficient_balance") {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
