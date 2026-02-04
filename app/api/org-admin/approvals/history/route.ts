import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const history = await prisma.approvalHistory.findMany({
      where: {
        expenseBase: {
          organizationId: session.organizationId,
          isActive: true,
        },
      },
      select: {
        id: true,
        action: true,
        comment: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
        expenseBase: {
          select: {
            id: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true, email: true } },
            receiptExpense: {
              select: {
                companyName: true,
                total: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const mapped = history.map((h) => ({
      id: h.id,
      action: h.action,
      comment: h.comment,
      createdAt: h.createdAt,
      performedBy: h.performedBy,
      expense: {
        id: h.expenseBase.id,
        companyName: h.expenseBase.receiptExpense?.companyName ?? "-",
        total: h.expenseBase.receiptExpense?.total ?? 0,
        createdAt: h.expenseBase.createdAt,
        createdByUser: h.expenseBase.createdBy,
      },
    }));

    return NextResponse.json({ history: mapped });
  } catch (error) {
    console.error("[org-admin] Get approvals history error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
