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
    const session = await requireRole(["ORG_ADMIN", "SUPER_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await prisma.expenseBase.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        status: "APPROVED",
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
        expenseType: true,
        receiptExpense: { select: { total: true } },
        paymentVoucherExpense: { select: { totalAmount: true } },
        generalExpense: { select: { amount: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const monthlyData = new Map<string, { total: number; count: number }>();

    expenses.forEach((expense) => {
      const monthKey = expense.createdAt.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const amount =
        expense.expenseType === "RECEIPT"
          ? asNumber(expense.receiptExpense?.total)
          : expense.expenseType === "PAYMENT_VOUCHER"
            ? asNumber(expense.paymentVoucherExpense?.totalAmount)
            : asNumber(expense.generalExpense?.amount);

      const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
      monthlyData.set(monthKey, {
        total: existing.total + amount,
        count: existing.count + 1,
      });
    });

    const chartData = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        amount: data.total,
        count: data.count,
      }))
      .sort(
        (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
      );

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("[org-admin] Get expenses-over-time error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
