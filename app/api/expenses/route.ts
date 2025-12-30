import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  categoryId: z.string().min(1),
  priority: z.enum(["HIGH", "NORMAL"]),
});

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const where: Prisma.ExpenseWhereInput = {
      organizationId: session.organizationId,
      isActive: true,
      ...(session.role === "STAFF" ? { userId: session.id } : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("[v0] Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = expenseSchema.parse(body);

    // Find an active policy for this category with a maxAmount
    const policy = await prisma.expensePolicy.findFirst({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        allowedCategories: { array_contains: [data.categoryId] },
        maxAmount: { not: null },
      },
    });

    const exceeds =
      policy && data.amount > (policy.maxAmount ?? Number.MAX_VALUE);
    const status = exceeds ? "WARNING" : "PENDING";

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          categoryId: data.categoryId,
          organizationId: session.organizationId!,
          userId: session.id,
          status,
          priority: data.priority,
          policyViolation: exceeds
            ? {
                policyId: policy?.id,
                reason: "Amount exceeds policy maximum",
                maxAmount: policy?.maxAmount,
                amount: data.amount,
              }
            : Prisma.DbNull,
        } as Prisma.ExpenseUncheckedCreateInput,
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "EXPENSE_CREATED",
          entityType: "Expense",
          entityId: expense.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return expense;
    });

    return NextResponse.json({ expense: created });
  } catch (error) {
    console.error("[v0] Create expense error:", error);
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
