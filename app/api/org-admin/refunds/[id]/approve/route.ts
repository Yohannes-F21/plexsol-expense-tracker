import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ERRORS = {
  MISSING_ORG: "Organization ID missing",
  NOT_FOUND: "Refund not found",
  NOT_PENDING: "Refund already finalized",
  FROM_NOT_FOUND: "Source account not found",
  TO_NOT_FOUND: "Destination account not found",
  INSUFFICIENT: "Insufficient balance",
} as const;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    if (!session.organizationId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const refund = await prisma.refund.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        status: true,
      },
    });

    if (!refund || refund.organizationId !== session.organizationId) {
      return NextResponse.json({ error: ERRORS.NOT_FOUND }, { status: 404 });
    }

    if (refund.status !== "PENDING") {
      return NextResponse.json({ error: ERRORS.NOT_PENDING }, { status: 400 });
    }

    const amount = new Prisma.Decimal(refund.amount);

    const result = await prisma.$transaction(
      async (tx) => {
        const fromAccount = await tx.bankAccount.findFirst({
          where: {
            id: refund.fromAccountId,
            organizationId: session.organizationId!,
            isActive: true,
          },
          select: { id: true, balance: true },
        });

        if (!fromAccount) {
          throw new Error("from_account_not_found");
        }

        const toAccount = await tx.bankAccount.findFirst({
          where: {
            id: refund.toAccountId,
            organizationId: session.organizationId!,
            isActive: true,
          },
          select: { id: true, balance: true },
        });

        if (!toAccount) {
          throw new Error("to_account_not_found");
        }

        const fromBalance = new Prisma.Decimal(fromAccount.balance);

        if (fromBalance.lt(amount)) {
          throw new Error("insufficient_balance");
        }

        const updatedFrom = await tx.bankAccount.update({
          where: { id: fromAccount.id },
          data: { balance: { decrement: amount } },
          select: { id: true, balance: true },
        });

        const updatedTo = await tx.bankAccount.update({
          where: { id: toAccount.id },
          data: { balance: { increment: amount } },
          select: { id: true, balance: true },
        });

        const updatedRefund = await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            rejectionReason: "",
          },
          select: {
            id: true,
            status: true,
            approvedAt: true,
            fromAccountId: true,
            toAccountId: true,
            amount: true,
          },
        });

        return {
          refund: updatedRefund,
          balances: { from: updatedFrom, to: updatedTo },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Approve refund error:", error);

    if (error instanceof Error) {
      if (error.message === "from_account_not_found") {
        return NextResponse.json(
          { error: ERRORS.FROM_NOT_FOUND },
          { status: 404 },
        );
      }
      if (error.message === "to_account_not_found") {
        return NextResponse.json(
          { error: ERRORS.TO_NOT_FOUND },
          { status: 404 },
        );
      }
      if (error.message === "insufficient_balance") {
        return NextResponse.json(
          { error: ERRORS.INSUFFICIENT },
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
