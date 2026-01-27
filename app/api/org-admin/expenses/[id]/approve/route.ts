import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        status: true,
        bankAccountId: true,
        total: true,
      },
    });

    if (
      !expense ||
      expense.organizationId !== session.organizationId ||
      !expense.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Expense already finalized" },
        { status: 400 }
      );
    }

    const amountToDeduct = new Prisma.Decimal(expense.total ?? 0);

    const updatedExpense = await prisma.$transaction(
      async (tx) => {
        if (expense.bankAccountId) {
          const bankAccount = await tx.bankAccount.findFirst({
            where: {
              id: expense.bankAccountId,
              organizationId: session.organizationId,
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

        const expenseUpdate = await tx.expense.update({
          where: { id },
          data: { status: "APPROVED", approvedAt: new Date() },
          select: {
            id: true,
            status: true,
            approvedAt: true,
          },
        });

        await tx.approvalHistory.create({
          data: {
            expenseId: id,
            action: "APPROVED",
            comment: null,
            performedById: session.id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.id,
            organizationId: session.organizationId,
            actionType: "EXPENSE_APPROVED",
            entityType: "Expense",
            entityId: id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return expenseUpdate;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error("[v0] Approve expense error:", error);

    if (error instanceof Error) {
      if (error.message === "bank_account_not_found") {
        return NextResponse.json(
          { error: "Bank account not found or inactive" },
          { status: 404 }
        );
      }

      if (error.message === "insufficient_balance") {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
