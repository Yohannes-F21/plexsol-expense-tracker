import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function asNumber(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  if (x && typeof x === "object" && typeof x.toNumber === "function") {
    const n = x.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        expenseBases: {
          where: { isActive: true, status: "APPROVED" },
          select: {
            expenseType: true,
            receiptExpense: { select: { total: true } },
            paymentVoucherExpense: { select: { totalAmount: true } },
            generalExpense: { select: { amount: true } },
          },
        },
      },
    });

    const chartData = organizations
      .map((org) => ({
        name: org.name,
        total: org.expenseBases.reduce((sum, e) => {
          const amount =
            e.expenseType === "RECEIPT"
              ? asNumber(e.receiptExpense?.total ?? 0)
              : e.expenseType === "PAYMENT_VOUCHER"
                ? asNumber(e.paymentVoucherExpense?.totalAmount ?? 0)
                : asNumber(e.generalExpense?.amount ?? 0);
          return sum + amount;
        }, 0),
        count: org.expenseBases.length,
      }))
      .filter((org) => org.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Get expenses by org chart error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
