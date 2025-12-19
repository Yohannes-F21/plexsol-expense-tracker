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

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const [updatedExpense] = await prisma.$transaction([
      prisma.expense.update({
        where: { id },
        data: { status: "REJECTED" },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId ?? null,
          actionType: "EXPENSE_REJECTED",
          entityType: "Expense",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      }),
    ]);

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error("[v0] Reject expense error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
