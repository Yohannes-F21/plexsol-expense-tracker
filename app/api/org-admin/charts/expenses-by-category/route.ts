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

    const lines = await prisma.expenseItem.findMany({
      where: {
        expense: {
          organizationId: orgId,
          isActive: true,
        },
      },
      select: {
        lineTotal: true,
        subcategory: { select: { name: true } },
      },
    });

    const byCategory = new Map<string, { category: string; amount: number }>();
    for (const line of lines) {
      const category = line.subcategory?.name ?? "Uncategorized";
      const existing = byCategory.get(category) ?? { category, amount: 0 };
      existing.amount += asNumber(line.lineTotal);
      byCategory.set(category, existing);
    }

    const result = Array.from(byCategory.values()).sort(
      (a, b) => b.amount - a.amount
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[org-admin] Get expenses-by-category error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
