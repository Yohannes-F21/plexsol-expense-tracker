import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const VAT_RATE = 0.15;

const paymentMethodSchema = z.enum([
  "CASH",
  "CHECK",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "OTHER",
]);

const expenseItemSchema = z.object({
  itemName: z.string().min(1),
  subcategoryId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const updateExpenseSchema = z.object({
  purchasedDate: z.coerce.date().optional(),
  companyName: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  fsNumber: z.string().min(1).optional(),
  invoiceNumber: z.string().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  items: z.array(expenseItemSchema).min(1).optional(),
});

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function evaluatePolicyViolations(args: {
  organizationId: string;
  items: Array<{ subcategoryId: string; lineTotal: number }>;
}) {
  const policies = await prisma.expensePolicy.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      maxAmount: { not: null },
    },
    select: {
      id: true,
      maxAmount: true,
      allowedCategories: true,
    },
  });

  const policyByCategoryId = new Map<
    string,
    Array<{ id: string; maxAmount: number }>
  >();
  for (const p of policies) {
    const allowed = Array.isArray(p.allowedCategories)
      ? (p.allowedCategories as any[])
      : [];
    for (const catId of allowed) {
      if (typeof catId !== "string") continue;
      const entry = { id: p.id, maxAmount: Number(p.maxAmount ?? 0) };
      const list = policyByCategoryId.get(catId) ?? [];
      list.push(entry);
      policyByCategoryId.set(catId, list);
    }
  }

  const perItem = args.items.map((it) => {
    const list = policyByCategoryId.get(it.subcategoryId) ?? [];
    const violated = list.some((p) => it.lineTotal > p.maxAmount);
    return { subcategoryId: it.subcategoryId, violated };
  });

  const anyViolated = perItem.some((x) => x.violated);
  return { perItem, anyViolated };
}

function canStaffEdit(status: string) {
  return status === "PENDING" || status === "WARNING" || status === "REJECTED";
}

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
        createdByUserId: true,
        organizationId: true,
        status: true,
        purchasedDate: true,
        companyName: true,
        tinNumber: true,
        fsNumber: true,
        invoiceNumber: true,
        paymentMethod: true,
        items: {
          select: {
            id: true,
            itemName: true,
            subcategoryId: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            hasPolicyViolation: true,
          },
        },
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (session.role === "STAFF" && !canStaffEdit(expense.status)) {
      return NextResponse.json(
        { error: "Cannot edit this expense at its current status" },
        { status: 400 }
      );
    }

    if (session.role === "ORG_ADMIN" && expense.status === "APPROVED") {
      return NextResponse.json(
        { error: "Cannot edit a finalized expense" },
        { status: 400 }
      );
    }

    const nextPurchasedDate = data.purchasedDate ?? expense.purchasedDate;
    const nextCompanyName = data.companyName ?? expense.companyName;
    const nextTinNumber = data.tinNumber ?? expense.tinNumber;
    const nextFsNumber = data.fsNumber ?? expense.fsNumber;
    const nextInvoiceNumber =
      data.invoiceNumber !== undefined
        ? data.invoiceNumber || null
        : expense.invoiceNumber;
    const nextPaymentMethod = data.paymentMethod ?? expense.paymentMethod;

    const itemsInput = data.items;
    const computedItems = (itemsInput ?? expense.items).map((it: any) => {
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const lineTotal = round2(qty * unitPrice);
      return {
        itemName: it.itemName,
        subcategoryId: it.subcategoryId,
        quantity: qty,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = round2(
      computedItems.reduce((sum, it) => sum + it.lineTotal, 0)
    );
    const vat = round2(subtotal * VAT_RATE);
    const total = round2(subtotal + vat);

    const { perItem, anyViolated } = await evaluatePolicyViolations({
      organizationId: session.organizationId,
      items: computedItems.map((it) => ({
        subcategoryId: it.subcategoryId,
        lineTotal: it.lineTotal,
      })),
    });

    const status: Prisma.ExpenseStatus = anyViolated ? "WARNING" : "PENDING";

    const updated = await prisma.$transaction(async (tx) => {
      if (itemsInput) {
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          purchasedDate: nextPurchasedDate,
          companyName: nextCompanyName,
          tinNumber: nextTinNumber,
          fsNumber: nextFsNumber,
          invoiceNumber: nextInvoiceNumber,
          paymentMethod: nextPaymentMethod,
          subtotal: new Prisma.Decimal(subtotal),
          vat: new Prisma.Decimal(vat),
          total: new Prisma.Decimal(total),
          status,
          ...(itemsInput
            ? {
                items: {
                  create: computedItems.map((it) => ({
                    itemName: it.itemName,
                    subcategoryId: it.subcategoryId,
                    quantity: new Prisma.Decimal(it.quantity),
                    unitPrice: new Prisma.Decimal(it.unitPrice),
                    lineTotal: new Prisma.Decimal(it.lineTotal),
                    hasPolicyViolation:
                      perItem.find((p) => p.subcategoryId === it.subcategoryId)
                        ?.violated ?? false,
                  })),
                },
              }
            : {}),
        },
        select: {
          id: true,
          purchasedDate: true,
          companyName: true,
          tinNumber: true,
          fsNumber: true,
          invoiceNumber: true,
          paymentMethod: true,
          subtotal: true,
          vat: true,
          total: true,
          status: true,
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

export async function GET(request: Request, context: any) {
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
      select: {
        id: true,
        purchasedDate: true,
        companyName: true,
        tinNumber: true,
        fsNumber: true,
        invoiceNumber: true,
        paymentMethod: true,
        subtotal: true,
        vat: true,
        total: true,
        status: true,
        createdAt: true,
        createdByUserId: true,
        organizationId: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            itemName: true,
            subcategoryId: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            hasPolicyViolation: true,
            subcategory: { select: { id: true, name: true, type: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("[v0] Get expense detail error:", error);
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
      select: {
        id: true,
        createdByUserId: true,
        organizationId: true,
        status: true,
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (session.role === "STAFF" && !canStaffEdit(expense.status)) {
      return NextResponse.json(
        { error: "Cannot delete this expense at its current status" },
        { status: 400 }
      );
    }

    if (session.role === "ORG_ADMIN" && expense.status === "APPROVED") {
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
