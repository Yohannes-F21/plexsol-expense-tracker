import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
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
    await requireRole(["SUPER_ADMIN"]);

    const [totalOrganizations, totalUsers, totalExpenses] = await Promise.all([
      prisma.organization.count({
        where: { isActive: true },
      }),
      prisma.user.count({
        where: { isActive: true },
      }),
      prisma.expenseBase.count({
        where: { isActive: true },
      }),
    ]);

    const [receiptSum, voucherSum, generalSum] = await Promise.all([
      prisma.receiptExpense.aggregate({
        where: {
          expenseBase: {
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { total: true },
      }),
      prisma.paymentVoucherExpense.aggregate({
        where: {
          expenseBase: {
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { totalAmount: true },
      }),
      prisma.generalExpense.aggregate({
        where: {
          expenseBase: {
            isActive: true,
            status: "APPROVED",
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalExpenseAmount =
      asNumber(receiptSum._sum.total) +
      asNumber(voucherSum._sum.totalAmount) +
      asNumber(generalSum._sum.amount);

    return NextResponse.json({
      totalOrganizations,
      totalUsers,
      totalExpenses,
      totalExpenseAmount,
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
