import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const updateExpenseSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  priority: z.enum(["HIGH", "NORMAL"]).optional(),
});

export async function PUT(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;
    const body = await request.json();
    const data = updateExpenseSchema.parse(body);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        status: true,
        amount: true,
        currency: true,
        categoryId: true,
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.userId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Cannot edit a finalized expense" },
        { status: 400 }
      );
    }

    let status = expense.status;
    let policyViolation:
      | Prisma.NullableJsonNullValueInput
      | Prisma.InputJsonValue = Prisma.DbNull;

    const newAmount = data.amount ?? expense.amount;
    const newCategoryId = data.categoryId ?? expense.categoryId;

    const policy = await prisma.expensePolicy.findFirst({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        allowedCategories: { array_contains: [newCategoryId] },
        maxAmount: { not: null },
      },
    });

    const exceeds =
      policy && newAmount > (policy.maxAmount ?? Number.MAX_VALUE);
    status = exceeds ? "WARNING" : "PENDING";
    policyViolation = exceeds
      ? {
          policyId: policy?.id,
          reason: "Amount exceeds policy maximum",
          maxAmount: policy?.maxAmount,
          amount: newAmount,
        }
      : Prisma.DbNull;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...data,
          status,
          policyViolation,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "EXPENSE_UPDATED",
          entityType: "Expense",
          entityId: updatedExpense.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return updatedExpense;
    });

    return NextResponse.json({ expense: updated });
  } catch (error) {
    console.error("[v0] Update expense error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true, status: true },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.userId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (expense.status === "APPROVED" || expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Cannot delete a finalized expense" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "EXPENSE_DELETED",
          entityType: "Expense",
          entityId: expense.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Delete expense error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
