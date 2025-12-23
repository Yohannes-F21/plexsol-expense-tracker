import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "SUPER_ADMIN"]);
    const orgId = session.organizationId;
    if (!orgId)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const expenses = await prisma.expense.findMany({
      where: { organizationId: orgId },
      select: { amount: true, category: { select: { id: true, name: true } } },
    });

    const byCategory = new Map<
      string,
      { id: string | null; name: string; total: number; count: number }
    >();

    expenses.forEach((e) => {
      const catId = e.category?.id ?? "uncategorized";
      const catName = e.category?.name ?? "Uncategorized";
      const existing = byCategory.get(catId) || {
        id: e.category?.id ?? null,
        name: catName,
        total: 0,
        count: 0,
      };
      existing.total += e.amount;
      existing.count += 1;
      byCategory.set(catId, existing);
    });

    const result = Array.from(byCategory.values()).sort(
      (a, b) => b.total - a.total
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
