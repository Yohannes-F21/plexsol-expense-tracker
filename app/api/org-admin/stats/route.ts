import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "SUPER_ADMIN"]);
    const orgId = session.organizationId;
    if (!orgId)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const [totalUsers, totalExpenses, pendingApprovals, totalExpenseAmount] =
      await Promise.all([
        prisma.user.count({ where: { organizationId: orgId } }),
        prisma.expense.count({ where: { organizationId: orgId } }),
        prisma.expense.count({
          where: { organizationId: orgId, status: "PENDING" },
        }),
        prisma.expense.aggregate({
          where: { organizationId: orgId },
          _sum: { amount: true },
        }),
      ]);

    return NextResponse.json({
      totalUsers,
      totalExpenses,
      pendingApprovals,
      totalExpenseAmount: totalExpenseAmount._sum?.amount ?? 0,
    });
  } catch (error) {
    console.error("[org-admin] Get stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
