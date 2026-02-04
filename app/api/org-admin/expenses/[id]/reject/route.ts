import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const rejectSchema = z
  .object({
    comment: z.string().optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    const parsed = rejectSchema
      ? rejectSchema.safeParse(await request.json().catch(() => undefined))
      : ({ success: true, data: undefined } as const);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const commentRaw = parsed.data?.comment;
    const comment = commentRaw?.trim() ? commentRaw.trim() : null;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const expense = await prisma.expenseBase.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        status: true,
        expenseType: true,
      },
    });

    if (
      !expense ||
      expense.organizationId !== session.organizationId ||
      !expense.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.expenseType !== "RECEIPT") {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Expense already finalized" },
        { status: 400 },
      );
    }

    const [updatedExpense] = await prisma.$transaction([
      prisma.expenseBase.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date() },
        select: { id: true, status: true },
      }),
      prisma.approvalHistory.create({
        data: {
          expenseBaseId: id,
          action: "REJECTED",
          comment,
          performedById: session.id,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
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
      { status: 500 },
    );
  }
}
