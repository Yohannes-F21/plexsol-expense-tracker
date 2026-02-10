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

    const transactions = await prisma.expenseBase.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        expenseType: true,
        status: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        receiptExpense: {
          select: {
            companyName: true,
            total: true,
            items: {
              take: 1,
              orderBy: { id: "asc" },
              select: { category: { select: { name: true } } },
            },
          },
        },
        paymentVoucherExpense: {
          select: {
            paidTo: true,
            totalAmount: true,
            items: {
              take: 1,
              orderBy: { id: "asc" },
              select: { category: { select: { name: true } } },
            },
          },
        },
        generalExpense: {
          select: {
            paidTo: true,
            description: true,
            amount: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const formattedWithNulls = transactions.map((t) => {
      if (t.expenseType === "RECEIPT" && t.receiptExpense) {
        return {
          id: t.id,
          expenseType: t.expenseType,
          amount: asNumber(t.receiptExpense.total),
          description: t.receiptExpense.companyName,
          status: t.status,
          createdAt: t.createdAt,
          user: { name: t.createdBy?.name ?? "-" },
          category: {
            name: t.receiptExpense.items[0]?.category?.name ?? "N/A",
          },
        };
      }

      if (t.expenseType === "PAYMENT_VOUCHER" && t.paymentVoucherExpense) {
        return {
          id: t.id,
          expenseType: t.expenseType,
          amount: asNumber(t.paymentVoucherExpense.totalAmount),
          description: t.paymentVoucherExpense.paidTo,
          status: t.status,
          createdAt: t.createdAt,
          user: { name: t.createdBy?.name ?? "-" },
          category: {
            name: t.paymentVoucherExpense.items[0]?.category?.name ?? "N/A",
          },
        };
      }

      if (t.expenseType === "GENERAL" && t.generalExpense) {
        return {
          id: t.id,
          expenseType: t.expenseType,
          amount: asNumber(t.generalExpense.amount),
          description: t.generalExpense.description || t.generalExpense.paidTo,
          status: t.status,
          createdAt: t.createdAt,
          user: { name: t.createdBy?.name ?? "-" },
          category: { name: t.generalExpense.category?.name ?? "N/A" },
        };
      }

      return null;
    });

    const formatted = formattedWithNulls.filter(
      (x): x is NonNullable<typeof x> => Boolean(x),
    );

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[org-admin] Get recent-transactions error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
