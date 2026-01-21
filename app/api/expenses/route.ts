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

const createExpenseSchema = z
  .object({
    purchasedDate: z.coerce.date(),
    companyName: z.string().min(1),
    tinNumber: z.string().min(1),
    fsNumber: z.string().min(1),
    mrcNumber: z.string().trim().optional(),
    invoiceNumber: z.string().optional(),
    paymentMethod: paymentMethodSchema,
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
    items: z.array(expenseItemSchema).min(1),
  })
  .superRefine((values, ctx) => {
    if (values.paymentMethod === "CHECK") {
      if (!values.checkNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checkNumber"],
          message: "Check number is required",
        });
      }
    }

    if (values.paymentMethod === "BANK_TRANSFER") {
      if (!values.bankAccountId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankAccountId"],
          message: "Bank account is required",
        });
      }
    }
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

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const organizationId = session.organizationId;

    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      isActive: true,
      ...(session.role === "STAFF" ? { createdByUserId: session.id } : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      select: {
        id: true,
        purchasedDate: true,
        companyName: true,
        fsNumber: true,
        tinNumber: true,
        mrcNumber: true,
        paymentMethod: true,
        subtotal: true,
        vat: true,
        total: true,
        status: true,
        createdAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { purchasedDate: "desc" },
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

    const organizationId = session.organizationId;

    const body = await request.json();
    const data = createExpenseSchema.parse(body);

    const checkNumber = data.checkNumber?.trim();
    const bankAccountId = data.bankAccountId?.trim();

    const normalizedItems = data.items.map((it) => ({
      ...it,
      vatCategory: (it.vatCategory ?? "G") as "G" | "S",
      unitOfMeasureId: it.unitOfMeasureId?.trim() || undefined,
      purchaseTypeId: it.purchaseTypeId?.trim() || undefined,
    }));

    const unitIds = Array.from(
      new Set(normalizedItems.map((it) => it.unitOfMeasureId).filter(Boolean))
    ) as string[];
    const purchaseTypeIds = Array.from(
      new Set(normalizedItems.map((it) => it.purchaseTypeId).filter(Boolean))
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

    if (data.paymentMethod === "BANK_TRANSFER") {
      const found = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          organizationId: session.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!found) {
        return NextResponse.json(
          { error: "Invalid bank account selection" },
          { status: 400 }
        );
      }
    }

    const computedItems = normalizedItems.map((it) => {
      const lineTotal = round2(it.quantity * it.unitPrice);
      return {
        itemName: it.itemName,
        subcategoryId: it.subcategoryId,
        vatCategory: it.vatCategory,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
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
      organizationId,
      items: computedItems.map((it) => ({
        subcategoryId: it.subcategoryId,
        lineTotal: it.lineTotal,
      })),
    });

    const status: ExpenseStatus = anyViolated ? "WARNING" : "PENDING";

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          purchasedDate: data.purchasedDate,
          companyName: data.companyName,
          tinNumber: data.tinNumber,
          fsNumber: data.fsNumber,
          mrcNumber: data.mrcNumber?.trim() || null,
          invoiceNumber: data.invoiceNumber || null,
          paymentMethod: data.paymentMethod,
          checkNumber:
            data.paymentMethod === "CHECK" ? checkNumber ?? null : null,
          bankAccountId:
            data.paymentMethod === "BANK_TRANSFER"
              ? bankAccountId ?? null
              : null,
          subtotal: new Prisma.Decimal(subtotal),
          vat: new Prisma.Decimal(vat),
          total: new Prisma.Decimal(total),
          status,
          createdByUserId: session.id,
          organizationId,
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
          checkNumber: true,
          bankAccountId: true,
          subtotal: true,
          vat: true,
          total: true,
          status: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId,
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
