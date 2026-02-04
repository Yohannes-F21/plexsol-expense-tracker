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

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await prisma.expenseBase.findMany({
      where: {
        isActive: true,
        status: "APPROVED",
        createdAt: {
          gte: sixMonthsAgo,
        },
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

    const monthlyData = new Map<
      string,
      { key: string; label: string; total: number; count: number }
    >();

    for (const expense of expenses) {
      const d = new Date(expense.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}`;
      const label = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const amount =
        expense.expenseType === "RECEIPT"
          ? asNumber(expense.receiptExpense?.total)
          : expense.expenseType === "PAYMENT_VOUCHER"
            ? asNumber(expense.paymentVoucherExpense?.totalAmount)
            : asNumber(expense.generalExpense?.amount);

      const existing = monthlyData.get(key) || {
        key,
        label,
        total: 0,
        count: 0,
      };
      monthlyData.set(key, {
        key,
        label,
        total: existing.total + amount,
        count: existing.count + 1,
      });
    }

    const chartData = Array.from(monthlyData.values())
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((x) => ({ month: x.label, total: x.total, count: x.count }));

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Get expenses chart error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
