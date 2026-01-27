import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createRefundSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.coerce.number().positive(),
  remark: z.string().trim().min(1, "Remark is required"),
});

const ERRORS = {
  MISSING_ORG: "Organization ID missing",
  SAME_ACCOUNT: "From and to accounts must be different",
  FROM_NOT_FOUND: "Source account not found",
  TO_NOT_FOUND: "Destination account not found",
} as const;

export async function GET() {
  try {
    const session = await requireRole(["STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const refunds = await prisma.refund.findMany({
      where: {
        organizationId: session.organizationId,
        requesterId: session.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        remark: true,
        rejectionReason: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
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
    console.error("[v0] Staff list refunds error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["STAFF"]);
    const orgId = session.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const body = await request.json();
    const data = createRefundSchema.parse(body);

    if (data.fromAccountId === data.toAccountId) {
      return NextResponse.json({ error: ERRORS.SAME_ACCOUNT }, { status: 400 });
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.bankAccount.findFirst({
        where: {
          id: data.fromAccountId,
          organizationId: orgId,
          isActive: true,
        },
        select: { id: true },
      }),
      prisma.bankAccount.findFirst({
        where: {
          id: data.toAccountId,
          organizationId: orgId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);

    if (!fromAccount) {
      return NextResponse.json(
        { error: ERRORS.FROM_NOT_FOUND },
        { status: 404 },
      );
    }

    if (!toAccount) {
      return NextResponse.json({ error: ERRORS.TO_NOT_FOUND }, { status: 404 });
    }

    const refund = await prisma.refund.create({
      data: {
        organizationId: orgId,
        requesterId: session.id,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: new Prisma.Decimal(data.amount),
        remark: data.remark,
        rejectionReason: "",
        status: "PENDING",
      },
      select: {
        id: true,
        amount: true,
        status: true,
        remark: true,
        rejectionReason: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
      },
    });

    return NextResponse.json({ refund });
  } catch (error) {
    console.error("[v0] Staff create refund error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
