import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (
      !expense ||
      expense.organizationId !== session.organizationId ||
      !expense.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Expense already finalized" },
        { status: 400 }
      );
    }

    const [updatedExpense] = await prisma.$transaction([
      prisma.expense.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date() },
        select: {
          id: true,
          status: true,
          approvedAt: true,
        },
      }),
      prisma.approvalHistory.create({
        data: {
          expenseId: id,
          action: "APPROVED",
          comment: null,
          performedById: session.id,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "EXPENSE_APPROVED",
          entityType: "Expense",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      }),
    ]);

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error("[v0] Approve expense error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
