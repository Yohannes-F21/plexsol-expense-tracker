import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "SUPER_ADMIN"]);
    const orgId = session.organizationId;
    if (!orgId)
      return NextResponse.json({ error: "No organization" }, { status: 400 });

    const transactions = await prisma.expense.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
      },
    });

    const formatted = transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      status: t.status,
      createdAt: t.createdAt,
      user: t.user,
      category: t.category,
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
