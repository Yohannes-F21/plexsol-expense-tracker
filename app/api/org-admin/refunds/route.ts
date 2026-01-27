import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createRefundSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.coerce.number().positive(),
});

const ERRORS = {
  MISSING_ORG: "Organization ID missing",
  SAME_ACCOUNT: "From and to accounts must be different",
  FROM_NOT_FOUND: "Source account not found",
  TO_NOT_FOUND: "Destination account not found",
  INSUFFICIENT: "Insufficient balance",
} as const;

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const orgId = session.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const refunds = await prisma.refund.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        fromAccount: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            balance: true,
          },
        },
        toAccount: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            balance: true,
          },
        },
      },
    });

    return NextResponse.json({ refunds });
  } catch (error) {
    console.error("[v0] List refunds error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const orgId = session.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const body = await request.json();
    const data = createRefundSchema.parse(body);

    if (data.fromAccountId === data.toAccountId) {
      return NextResponse.json({ error: ERRORS.SAME_ACCOUNT }, { status: 400 });
    }

    const amount = new Prisma.Decimal(data.amount);

    const result = await prisma.$transaction(
      async (tx) => {
        const fromAccount = await tx.bankAccount.findFirst({
          where: {
            id: data.fromAccountId,
            organizationId: orgId,
            isActive: true,
          },
          select: { id: true, balance: true },
        });

        if (!fromAccount) {
          throw new Error("from_account_not_found");
        }

        const toAccount = await tx.bankAccount.findFirst({
          where: {
            id: data.toAccountId,
            organizationId: orgId,
            isActive: true,
          },
          select: { id: true },
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

        const refund = await tx.refund.create({
          data: {
            organizationId: orgId,
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            amount,
          },
          select: {
            id: true,
            organizationId: true,
            fromAccountId: true,
            toAccountId: true,
            amount: true,
            createdAt: true,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.id,
            organizationId: orgId,
            actionType: "REFUND_CREATED",
            entityType: "Refund",
            entityId: refund.id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return { refund, balances: { from: updatedFrom, to: updatedTo } };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[v0] Create refund error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "from_account_not_found") {
        return NextResponse.json({ error: ERRORS.FROM_NOT_FOUND }, { status: 404 });
      }
      if (error.message === "to_account_not_found") {
        return NextResponse.json({ error: ERRORS.TO_NOT_FOUND }, { status: 404 });
      }
      if (error.message === "insufficient_balance") {
        return NextResponse.json({ error: ERRORS.INSUFFICIENT }, { status: 400 });
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
