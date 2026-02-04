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

    const [receiptLines, voucherLines, generalRows] = await Promise.all([
      prisma.receiptExpenseItem.findMany({
        where: {
          receiptExpense: {
            expenseBase: {
              organizationId: orgId,
              isActive: true,
              status: "APPROVED",
            },
          },
        },
        select: {
          lineTotal: true,
          category: { select: { name: true } },
        },
      }),
      prisma.paymentVoucherItem.findMany({
        where: {
          paymentVoucher: {
            expenseBase: {
              organizationId: orgId,
              isActive: true,
              status: "APPROVED",
            },
          },
        },
        select: {
          lineTotal: true,
          category: { select: { name: true } },
        },
      }),
      prisma.generalExpense.findMany({
        where: {
          expenseBase: {
            organizationId: orgId,
            isActive: true,
            status: "APPROVED",
          },
        },
        select: {
          amount: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    const byCategory = new Map<string, { category: string; amount: number }>();
    const add = (categoryName: string | null | undefined, amount: any) => {
      const category = categoryName?.trim() || "Uncategorized";
      const existing = byCategory.get(category) ?? { category, amount: 0 };
      existing.amount += asNumber(amount);
      byCategory.set(category, existing);
    };

    for (const line of receiptLines) add(line.category?.name, line.lineTotal);
    for (const line of voucherLines) add(line.category?.name, line.lineTotal);
    for (const row of generalRows) add(row.category?.name, row.amount);

    const result = Array.from(byCategory.values()).sort(
      (a, b) => b.amount - a.amount,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[org-admin] Get expenses-by-category error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
