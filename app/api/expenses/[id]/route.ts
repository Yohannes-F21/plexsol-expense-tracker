import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseStatus, Prisma } from "@prisma/client";

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
  vatCategory: z.enum(["G", "S"]).optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  unitOfMeasureId: z.string().optional(),
  purchaseTypeId: z.string().optional(),
});

const updateExpenseSchema = z.object({
  purchasedDate: z.coerce.date().optional(),
  companyName: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  fsNumber: z.string().min(1).optional(),
  mrcNumber: z.string().trim().optional(),
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
        mrcNumber: true,
        invoiceNumber: true,
        paymentMethod: true,
        items: {
          select: {
            id: true,
            itemName: true,
            subcategoryId: true,
            vatCategory: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            unitOfMeasureId: true,
            purchaseTypeId: true,
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
    const nextMrcNumber =
      data.mrcNumber !== undefined
        ? data.mrcNumber?.trim() || null
        : expense.mrcNumber;
    const nextInvoiceNumber =
      data.invoiceNumber !== undefined
        ? data.invoiceNumber || null
        : expense.invoiceNumber;
    const nextPaymentMethod = data.paymentMethod ?? expense.paymentMethod;

    const itemsInput = data.items;
    const normalizedItems = (itemsInput ?? expense.items).map((it: any) => ({
      ...it,
      vatCategory: (it.vatCategory ?? "G") as "G" | "S",
      unitOfMeasureId: it.unitOfMeasureId?.trim
        ? it.unitOfMeasureId.trim() || undefined
        : it.unitOfMeasureId || undefined,
      purchaseTypeId: it.purchaseTypeId?.trim
        ? it.purchaseTypeId.trim() || undefined
        : it.purchaseTypeId || undefined,
    }));

    const unitIds = Array.from(
      new Set(
        normalizedItems.map((it: any) => it.unitOfMeasureId).filter(Boolean)
      )
    ) as string[];
    const purchaseTypeIds = Array.from(
      new Set(
        normalizedItems.map((it: any) => it.purchaseTypeId).filter(Boolean)
      )
    ) as string[];

    if (unitIds.length) {
      const found = await prisma.unitOfMeasure.findMany({
        where: {
          id: { in: unitIds },
          organizationId: session.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (found.length !== unitIds.length) {
        return NextResponse.json(
          { error: "Invalid unit of measure selection" },
          { status: 400 }
        );
      }
    }

    if (purchaseTypeIds.length) {
      const found = await prisma.purchaseType.findMany({
        where: {
          id: { in: purchaseTypeIds },
          organizationId: session.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (found.length !== purchaseTypeIds.length) {
        return NextResponse.json(
          { error: "Invalid purchase type selection" },
          { status: 400 }
        );
      }
    }

    const computedItems = normalizedItems.map((it: any) => {
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const lineTotal = round2(qty * unitPrice);
      return {
        itemName: it.itemName,
        subcategoryId: it.subcategoryId,
        vatCategory: it.vatCategory,
        quantity: qty,
        unitPrice,
        lineTotal,
        unitOfMeasureId: it.unitOfMeasureId,
        purchaseTypeId: it.purchaseTypeId,
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

    const status: ExpenseStatus = anyViolated ? "WARNING" : "PENDING";

    const previousExpense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        purchasedDate: true,
        companyName: true,
        tinNumber: true,
        fsNumber: true,
        mrcNumber: true,
        invoiceNumber: true,
        paymentMethod: true,
        subtotal: true,
        vat: true,
        total: true,
        status: true,
      },
    });

    if (!previousExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const previousValue = {
      purchasedDate: previousExpense.purchasedDate?.toISOString?.() ?? null,
      companyName: previousExpense.companyName,
      tinNumber: previousExpense.tinNumber,
      fsNumber: previousExpense.fsNumber,
      mrcNumber: previousExpense.mrcNumber,
      invoiceNumber: previousExpense.invoiceNumber,
      paymentMethod: previousExpense.paymentMethod,
      subtotal:
        previousExpense.subtotal?.toString?.() ??
        String(previousExpense.subtotal),
      vat: previousExpense.vat?.toString?.() ?? String(previousExpense.vat),
      total:
        previousExpense.total?.toString?.() ?? String(previousExpense.total),
      status: previousExpense.status,
    };

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
          mrcNumber: nextMrcNumber,
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
                    vatCategory: it.vatCategory,
                    quantity: new Prisma.Decimal(it.quantity),
                    unitPrice: new Prisma.Decimal(it.unitPrice),
                    lineTotal: new Prisma.Decimal(it.lineTotal),
                    unitOfMeasureId: it.unitOfMeasureId ?? null,
                    purchaseTypeId: it.purchaseTypeId ?? null,
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
          mrcNumber: true,
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
          previousValue,
          newValue: {
            purchasedDate:
              updatedExpense.purchasedDate?.toISOString?.() ?? null,
            companyName: updatedExpense.companyName,
            tinNumber: updatedExpense.tinNumber,
            fsNumber: updatedExpense.fsNumber,
            mrcNumber: updatedExpense.mrcNumber,
            invoiceNumber: updatedExpense.invoiceNumber,
            paymentMethod: updatedExpense.paymentMethod,
            subtotal:
              updatedExpense.subtotal?.toString?.() ??
              String(updatedExpense.subtotal),
            vat: updatedExpense.vat?.toString?.() ?? String(updatedExpense.vat),
            total:
              updatedExpense.total?.toString?.() ??
              String(updatedExpense.total),
            status: updatedExpense.status,
          },
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
        mrcNumber: true,
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
            vatCategory: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            unitOfMeasureId: true,
            purchaseTypeId: true,
            hasPolicyViolation: true,
            subcategory: { select: { id: true, name: true, type: true } },
            unitOfMeasure: { select: { id: true, label: true, code: true } },
            purchaseType: { select: { id: true, label: true, code: true } },
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
