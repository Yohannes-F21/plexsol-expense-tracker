import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function") {
    return x.toNumber();
  }
  return Number(x);
}

export async function GET() {
  try {
    const session = await requireAuth();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const organizationId = session.organizationId;

    const baseWhere = {
      organizationId,
      createdByUserId: session.id,
      expenseType: "RECEIPT",
      isActive: true,
    } as const;

    const [totalExpenses, pendingExpenses, approvedExpenses, rejectedExpenses] =
      await Promise.all([
        prisma.expenseBase.count({
          where: baseWhere,
        }),
        prisma.expenseBase.count({
          where: { ...baseWhere, status: "PENDING" },
        }),
        prisma.expenseBase.count({
          where: { ...baseWhere, status: "APPROVED" },
        }),
        prisma.expenseBase.count({
          where: { ...baseWhere, status: "REJECTED" },
        }),
      ]);

    const totalExpenseAmount = await prisma.receiptExpense.aggregate({
      where: {
        expenseBase: { ...baseWhere, status: "APPROVED" },
      },
      _sum: {
        total: true,
      },
    });

    return NextResponse.json({
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      totalExpenseAmount: asNumber(totalExpenseAmount._sum.total) || 0,
    });
  } catch (error) {
    console.error(" Get stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
