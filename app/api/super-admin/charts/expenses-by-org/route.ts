import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
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
              ? asNumber(e.receiptExpense?.total)
              : e.expenseType === "PAYMENT_VOUCHER"
                ? asNumber(e.paymentVoucherExpense?.totalAmount)
                : asNumber(e.generalExpense?.amount);
          return sum + amount;
        }, 0),
        count: org.expenseBases.length,
      }))
      .filter((org) => org.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("[v0] Get expenses by org chart error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
