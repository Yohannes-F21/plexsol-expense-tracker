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
        { status: 400 },
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
      prisma.expenseBase.count({
        where: {
          organizationId: orgId,
          isActive: true,
        },
      }),
      prisma.expenseBase.count({
        where: {
          organizationId: orgId,
          isActive: true,
          status: "PENDING",
        },
      }),
      prisma.expenseBase.count({
        where: {
          organizationId: orgId,
          isActive: true,
          status: "APPROVED",
        },
      }),
      prisma.expenseBase.count({
        where: {
          organizationId: orgId,
          isActive: true,
          status: "REJECTED",
        },
      }),
      prisma.expenseBase.count({
        where: {
          organizationId: orgId,
          isActive: true,
          status: "WARNING",
        },
      }),
    ]);

    const pendingApprovals = pendingExpenses + warningExpenses;

    const [receiptSum, voucherSum, generalSum] = await Promise.all([
      prisma.receiptExpense.aggregate({
        where: {
          expenseBase: {
            organizationId: orgId,
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { total: true },
      }),
      prisma.paymentVoucherExpense.aggregate({
        where: {
          expenseBase: {
            organizationId: orgId,
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { totalAmount: true },
      }),
      prisma.generalExpense.aggregate({
        where: {
          expenseBase: {
            organizationId: orgId,
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const receiptTotal = receiptSum._sum.total
      ? Number(receiptSum._sum.total)
      : 0;
    const voucherTotal = voucherSum._sum.totalAmount
      ? Number(voucherSum._sum.totalAmount)
      : 0;
    const generalTotal = generalSum._sum.amount
      ? Number(generalSum._sum.amount)
      : 0;
    const totalExpenseAmountValue = receiptTotal + voucherTotal + generalTotal;

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
    console.error("Get stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
