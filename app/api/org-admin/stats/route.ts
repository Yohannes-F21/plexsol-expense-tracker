import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const [
      totalUsers,
      totalStaffs,
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      warningExpenses,
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId } }),
      prisma.user.count({
        where: { organizationId: orgId, role: "STAFF", isActive: true },
      }),
      prisma.expense.count({
        where: { organizationId: orgId, isActive: true },
      }),
      prisma.expense.count({
        where: { organizationId: orgId, isActive: true, status: "PENDING" },
      }),
      prisma.expense.count({
        where: { organizationId: orgId, isActive: true, status: "APPROVED" },
      }),
      prisma.expense.count({
        where: { organizationId: orgId, isActive: true, status: "REJECTED" },
      }),
      prisma.expense.count({
        where: { organizationId: orgId, isActive: true, status: "WARNING" },
      }),
    ]);

    const pendingApprovals = pendingExpenses + warningExpenses;

    const totalExpenseAmount = await prisma.expense.aggregate({
      where: {
        organizationId: orgId,
        isActive: true,
        status: "APPROVED",
      },
      _sum: {
        total: true,
      },
    });

    const totalExpenseAmountValue = totalExpenseAmount._sum.total
      ? Number(totalExpenseAmount._sum.total)
      : 0;

    return NextResponse.json({
      totalUsers,
      totalStaffs,
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      warningExpenses,
      pendingApprovals,
      totalExpenseAmount: totalExpenseAmountValue,
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
