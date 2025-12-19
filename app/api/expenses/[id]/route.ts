import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional(),
});

export async function PUT(request: Request, context: any) {
  try {
    const session = await requireAuth();
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;
    const body = await request.json();
    const validatedData = expenseSchema.parse(body);

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense || existingExpense.userId !== session.id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existingExpense.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot edit approved or rejected expenses" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency ?? "USD",
      },
    });

    return NextResponse.json({ expense });
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
    const session = await requireAuth();
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense || existingExpense.userId !== session.id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existingExpense.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot delete approved or rejected expenses" },
        { status: 400 }
      );
    }

    await prisma.expense.delete({
      where: { id },
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
