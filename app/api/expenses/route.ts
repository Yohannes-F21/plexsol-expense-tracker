import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseStatus, ExpenseType, Prisma } from "@prisma/client";

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

const paymentVoucherItemSchema = z.object({
  itemName: z.string().min(1),
  categoryId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const createReceiptExpenseSchema = z.object({
  expenseType: z.literal("RECEIPT"),
  purchasedDate: z.coerce.date(),
  companyName: z.string().min(1),
  tinNumber: z.string().min(1),
  fsNumber: z.string().min(1),
  mrcNumber: z.string().trim().min(1, "MRC number is required"),
  invoiceNumber: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  items: z.array(expenseItemSchema).min(1),
});

const createPaymentVoucherSchema = z.object({
  expenseType: z.literal("PAYMENT_VOUCHER"),
  purchasedDate: z.coerce.date(),
  paidTo: z.string().min(1),
  tinNumber: z.string().optional(),
  invoiceNumber: z.string().min(1),
  paymentMethod: paymentMethodSchema,
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  items: z.array(paymentVoucherItemSchema).min(1),
});

const createGeneralExpenseSchema = z.object({
  expenseType: z.literal("GENERAL"),
  paymentDate: z.coerce.date(),
  paidTo: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: paymentMethodSchema,
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  categoryId: z.string().min(1),
});

const createExpenseSchema = z.discriminatedUnion("expenseType", [
  createReceiptExpenseSchema,
  createPaymentVoucherSchema,
  createGeneralExpenseSchema,
]);

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

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const organizationId = session.organizationId;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const expenseTypeParam = searchParams.get("expenseType");
    const status =
      statusParam &&
      ["PENDING", "WARNING", "APPROVED", "REJECTED"].includes(statusParam)
        ? (statusParam as ExpenseStatus)
        : undefined;

    const expenseType =
      expenseTypeParam &&
      ["RECEIPT", "PAYMENT_VOUCHER", "GENERAL"].includes(expenseTypeParam)
        ? (expenseTypeParam as ExpenseType)
        : undefined;

    const baseWhere: Prisma.ExpenseBaseWhereInput = {
      organizationId,
      isActive: true,
      ...(session.role === "STAFF" ? { createdByUserId: session.id } : {}),
      ...(status ? { status } : {}),
      ...(expenseType ? { expenseType } : {}),
      ...(q
        ? {
            OR: [
              {
                createdBy: {
                  is: { name: { contains: q, mode: "insensitive" } },
                },
              },
              {
                createdBy: {
                  is: { email: { contains: q, mode: "insensitive" } },
                },
              },
              {
                receiptExpense: {
                  is: { companyName: { contains: q, mode: "insensitive" } },
                },
              },
              {
                receiptExpense: {
                  is: { fsNumber: { contains: q, mode: "insensitive" } },
                },
              },
              {
                receiptExpense: {
                  is: {
                    invoiceNumber: { contains: q, mode: "insensitive" },
                  },
                },
              },
              {
                receiptExpense: {
                  is: { tinNumber: { contains: q, mode: "insensitive" } },
                },
              },
              {
                receiptExpense: {
                  is: { mrcNumber: { contains: q, mode: "insensitive" } },
                },
              },
              {
                paymentVoucherExpense: {
                  is: { paidTo: { contains: q, mode: "insensitive" } },
                },
              },
              {
                paymentVoucherExpense: {
                  is: {
                    invoiceNumber: { contains: q, mode: "insensitive" },
                  },
                },
              },
              {
                paymentVoucherExpense: {
                  is: { tinNumber: { contains: q, mode: "insensitive" } },
                },
              },
              {
                generalExpense: {
                  is: { paidTo: { contains: q, mode: "insensitive" } },
                },
              },
              {
                generalExpense: {
                  is: { description: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };

    const rawExpenses = await prisma.expenseBase.findMany({
      where: baseWhere,
      select: {
        id: true,
        expenseType: true,
        status: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvalHistory: {
          where: { action: "REJECTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { comment: true },
        },
        receiptExpense: {
          select: {
            purchasedDate: true,
            companyName: true,
            fsNumber: true,
            invoiceNumber: true,
            tinNumber: true,
            mrcNumber: true,
            paymentMethod: true,
            subtotal: true,
            vat: true,
            total: true,
            items: {
              where: { hasPolicyViolation: true },
              select: { itemName: true },
            },
          },
        },
        paymentVoucherExpense: {
          select: {
            purchasedDate: true,
            paidTo: true,
            invoiceNumber: true,
            tinNumber: true,
            paymentMethod: true,
            totalAmount: true,
          },
        },
        generalExpense: {
          select: {
            paymentDate: true,
            paidTo: true,
            description: true,
            paymentMethod: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const expenses = rawExpenses
      .map((row) => {
        if (row.expenseType === "RECEIPT" && row.receiptExpense) {
          const warningItems = (row.receiptExpense.items ?? [])
            .map((it) => String(it.itemName ?? "").trim())
            .filter(Boolean);
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.receiptExpense.purchasedDate,
            vendor: row.receiptExpense.companyName,
            reference: row.receiptExpense.fsNumber,
            invoiceNumber: row.receiptExpense.invoiceNumber ?? null,
            tinNumber: row.receiptExpense.tinNumber,
            mrcNumber: row.receiptExpense.mrcNumber,
            paymentMethod: row.receiptExpense.paymentMethod,
            total: row.receiptExpense.total,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
            warningItems,
            rejectionComment: row.approvalHistory?.[0]?.comment ?? null,
          };
        }

        if (
          row.expenseType === "PAYMENT_VOUCHER" &&
          row.paymentVoucherExpense
        ) {
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.paymentVoucherExpense.purchasedDate,
            vendor: row.paymentVoucherExpense.paidTo,
            reference: row.paymentVoucherExpense.invoiceNumber,
            paymentMethod: row.paymentVoucherExpense.paymentMethod,
            total: row.paymentVoucherExpense.totalAmount,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
            warningItems: [],
            rejectionComment: row.approvalHistory?.[0]?.comment ?? null,
          };
        }

        if (row.expenseType === "GENERAL" && row.generalExpense) {
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.generalExpense.paymentDate,
            vendor: row.generalExpense.paidTo,
            reference: row.generalExpense.description,
            paymentMethod: row.generalExpense.paymentMethod,
            total: row.generalExpense.amount,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
            warningItems: [],
            rejectionComment: row.approvalHistory?.[0]?.comment ?? null,
          };
        }

        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("[v0] Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const organizationId = session.organizationId;

    const body = await request.json();
    const data = createExpenseSchema.parse(body);

    if (data.expenseType === "RECEIPT") {
      const checkNumber = data.checkNumber?.trim();
      const bankAccountId = data.bankAccountId?.trim();

      if (data.paymentMethod === "CHECK" && !checkNumber) {
        return NextResponse.json(
          { error: "Check number is required" },
          { status: 400 },
        );
      }

      if (data.paymentMethod === "BANK_TRANSFER" && !bankAccountId) {
        return NextResponse.json(
          { error: "Bank account is required" },
          { status: 400 },
        );
      }

      const normalizedItems = data.items.map((it) => ({
        ...it,
        vatCategory: (it.vatCategory ?? "G") as "G" | "S",
        unitOfMeasureId: it.unitOfMeasureId?.trim() || undefined,
        purchaseTypeId: it.purchaseTypeId?.trim() || undefined,
      }));

      const unitIds = Array.from(
        new Set(
          normalizedItems.map((it) => it.unitOfMeasureId).filter(Boolean),
        ),
      ) as string[];
      const purchaseTypeIds = Array.from(
        new Set(normalizedItems.map((it) => it.purchaseTypeId).filter(Boolean)),
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
            { status: 400 },
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
            { status: 400 },
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
            { status: 400 },
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
        computedItems.reduce((sum, it) => sum + it.lineTotal, 0),
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
        const base = await tx.expenseBase.create({
          data: {
            organizationId,
            createdByUserId: session.id,
            expenseType: "RECEIPT",
            status,
          },
          select: { id: true, status: true },
        });

        const receipt = await tx.receiptExpense.create({
          data: {
            expenseBaseId: base.id,
            purchasedDate: data.purchasedDate,
            companyName: data.companyName,
            tinNumber: data.tinNumber,
            fsNumber: data.fsNumber,
            mrcNumber: data.mrcNumber?.trim() || null,
            invoiceNumber: data.invoiceNumber || null,
            paymentMethod: data.paymentMethod,
            checkNumber:
              data.paymentMethod === "CHECK" ? (checkNumber ?? null) : null,
            bankAccountId:
              data.paymentMethod === "BANK_TRANSFER"
                ? (bankAccountId ?? null)
                : null,
            subtotal: new Prisma.Decimal(subtotal),
            vat: new Prisma.Decimal(vat),
            total: new Prisma.Decimal(total),
            items: {
              create: computedItems.map((it) => ({
                itemName: it.itemName,
                categoryId: it.subcategoryId,
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
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.id,
            organizationId,
            actionType: "EXPENSE_CREATED",
            entityType: "Expense",
            entityId: base.id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return { base, receipt };
      });

      return NextResponse.json({
        expense: {
          ...created.receipt,
          id: created.base.id,
          status: created.base.status,
          expenseType: "RECEIPT",
        },
      });
    }

    if (data.expenseType === "PAYMENT_VOUCHER") {
      const checkNumber = data.checkNumber?.trim();
      const bankAccountId = data.bankAccountId?.trim();

      if (data.paymentMethod === "CHECK" && !checkNumber) {
        return NextResponse.json(
          { error: "Check number is required" },
          { status: 400 },
        );
      }

      if (data.paymentMethod === "BANK_TRANSFER") {
        if (!bankAccountId) {
          return NextResponse.json(
            { error: "Bank account is required" },
            { status: 400 },
          );
        }

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
            { status: 400 },
          );
        }
      }

      const computedItems = data.items.map((it) => {
        const lineTotal = round2(it.quantity * it.unitPrice);
        return {
          itemName: it.itemName,
          categoryId: it.categoryId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal,
        };
      });

      const totalAmount = round2(
        computedItems.reduce((sum, it) => sum + it.lineTotal, 0),
      );

      const created = await prisma.$transaction(async (tx) => {
        const base = await tx.expenseBase.create({
          data: {
            organizationId,
            createdByUserId: session.id,
            expenseType: "PAYMENT_VOUCHER",
            status: "PENDING",
          },
          select: { id: true, status: true },
        });

        const voucher = await tx.paymentVoucherExpense.create({
          data: {
            expenseBaseId: base.id,
            invoiceNumber: data.invoiceNumber,
            purchasedDate: data.purchasedDate,
            paidTo: data.paidTo,
            tinNumber: data.tinNumber || null,
            totalAmount: new Prisma.Decimal(totalAmount),
            paymentMethod: data.paymentMethod,
            checkNumber:
              data.paymentMethod === "CHECK" ? (checkNumber ?? null) : null,
            bankAccountId:
              data.paymentMethod === "BANK_TRANSFER"
                ? (bankAccountId ?? null)
                : null,
            items: {
              create: computedItems.map((it) => ({
                itemName: it.itemName,
                categoryId: it.categoryId,
                quantity: new Prisma.Decimal(it.quantity),
                unitPrice: new Prisma.Decimal(it.unitPrice),
                lineTotal: new Prisma.Decimal(it.lineTotal),
              })),
            },
          },
          select: {
            id: true,
            invoiceNumber: true,
            purchasedDate: true,
            paidTo: true,
            tinNumber: true,
            totalAmount: true,
            paymentMethod: true,
            checkNumber: true,
            bankAccountId: true,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.id,
            organizationId,
            actionType: "EXPENSE_CREATED",
            entityType: "Expense",
            entityId: base.id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return { base, voucher };
      });

      return NextResponse.json({
        expense: {
          ...created.voucher,
          id: created.base.id,
          status: created.base.status,
          expenseType: "PAYMENT_VOUCHER",
        },
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const checkNumber = data.checkNumber?.trim();
      const bankAccountId = data.bankAccountId?.trim();

      if (data.paymentMethod === "CHECK" && !checkNumber) {
        throw new Error("check_number_required");
      }

      if (data.paymentMethod === "BANK_TRANSFER") {
        if (!bankAccountId) {
          throw new Error("bank_account_required");
        }

        const found = await tx.bankAccount.findFirst({
          where: {
            id: bankAccountId,
            organizationId: session.organizationId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!found) {
          throw new Error("invalid_bank_account");
        }
      }

      const base = await tx.expenseBase.create({
        data: {
          organizationId,
          createdByUserId: session.id,
          expenseType: "GENERAL",
          status: "PENDING",
        },
        select: { id: true, status: true },
      });

      const general = await tx.generalExpense.create({
        data: {
          expenseBaseId: base.id,
          paymentDate: data.paymentDate,
          paidTo: data.paidTo,
          description: data.description,
          amount: new Prisma.Decimal(data.amount),
          paymentMethod: data.paymentMethod,
          checkNumber:
            data.paymentMethod === "CHECK" ? (checkNumber ?? null) : null,
          bankAccountId:
            data.paymentMethod === "BANK_TRANSFER"
              ? (bankAccountId ?? null)
              : null,
          categoryId: data.categoryId,
        },
        select: {
          id: true,
          paymentDate: true,
          paidTo: true,
          description: true,
          amount: true,
          paymentMethod: true,
          checkNumber: true,
          bankAccountId: true,
          categoryId: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId,
          actionType: "EXPENSE_CREATED",
          entityType: "Expense",
          entityId: base.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return { base, general };
    });

    return NextResponse.json({
      expense: {
        ...created.general,
        id: created.base.id,
        status: created.base.status,
        expenseType: "GENERAL",
      },
    });
  } catch (error) {
    console.error("[v0] Create expense error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "check_number_required") {
        return NextResponse.json(
          { error: "Check number is required" },
          { status: 400 },
        );
      }
      if (error.message === "bank_account_required") {
        return NextResponse.json(
          { error: "Bank account is required" },
          { status: 400 },
        );
      }
      if (error.message === "invalid_bank_account") {
        return NextResponse.json(
          { error: "Invalid bank account selection" },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
