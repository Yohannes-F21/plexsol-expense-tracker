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

    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    start.setUTCMonth(start.getUTCMonth() - 5);
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [receipts, vouchers, generals] = await Promise.all([
      prisma.receiptExpense.findMany({
        where: {
          purchasedDate: { gte: start, lt: end },
          expenseBase: {
            is: {
              isActive: true,
              status: "APPROVED",
            },
          },
        },
        select: { purchasedDate: true, total: true },
      }),
      prisma.paymentVoucherExpense.findMany({
        where: {
          purchasedDate: { gte: start, lt: end },
          expenseBase: {
            is: {
              isActive: true,
              status: "APPROVED",
            },
          },
        },
        select: { purchasedDate: true, totalAmount: true },
      }),
      prisma.generalExpense.findMany({
        where: {
          paymentDate: { gte: start, lt: end },
          expenseBase: {
            is: {
              isActive: true,
              status: "APPROVED",
            },
          },
        },
        select: { paymentDate: true, amount: true },
      }),
    ]);

    const buckets = new Map<string, { total: number; count: number }>();
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    });

    function addToBucket(date: Date, amount: number) {
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const existing = buckets.get(key) ?? { total: 0, count: 0 };
      buckets.set(key, {
        total: existing.total + amount,
        count: existing.count + 1,
      });
    }

    for (const r of receipts) addToBucket(r.purchasedDate, asNumber(r.total));
    for (const v of vouchers)
      addToBucket(v.purchasedDate, asNumber(v.totalAmount));
    for (const g of generals) addToBucket(g.paymentDate, asNumber(g.amount));

    const chartData = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(start);
      d.setUTCMonth(start.getUTCMonth() + idx);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = monthFormatter.format(d);
      const bucket = buckets.get(key) ?? { total: 0, count: 0 };
      return {
        month: label,
        total: bucket.total,
        count: bucket.count,
      };
    });

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
