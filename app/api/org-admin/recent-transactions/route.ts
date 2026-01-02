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

    const transactions = await prisma.expense.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        companyName: true,
        total: true,
        status: true,
        createdAt: true,
        createdByUser: { select: { name: true } },
        items: {
          take: 1,
          orderBy: { id: "asc" },
          select: { subcategory: { select: { name: true } } },
        },
      },
    });

    const formatted = transactions.map((t) => ({
      id: t.id,
      amount: asNumber(t.total),
      description: t.companyName,
      status: t.status,
      createdAt: t.createdAt,
      user: { name: t.createdByUser?.name ?? "-" },
      category: { name: t.items[0]?.subcategory?.name ?? "N/A" },
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[org-admin] Get recent-transactions error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
