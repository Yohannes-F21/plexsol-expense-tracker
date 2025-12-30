import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    const [totalUsers, totalExpenses, pendingExpenses, approvedExpenses] =
      await Promise.all([
        prisma.user.count({
          where: { organizationId: session.organizationId! },
        }),
        prisma.expense.count({
          where: { organizationId: session.organizationId! },
        }),
        prisma.expense.count({
          where: {
            organizationId: session.organizationId!,
            status: "PENDING",
          },
        }),
        prisma.expense.count({
          where: {
            organizationId: session.organizationId!,
            status: "APPROVED",
          },
        }),
      ]);

    const totalExpenseAmount = await prisma.expense.aggregate({
      where: {
        organizationId: session.organizationId!,
        status: "APPROVED",
      },
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      totalUsers,
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      totalExpenseAmount: totalExpenseAmount._sum.amount || 0,
    });
  } catch (error) {
    console.error("[v0] Get stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
