import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { canDeleteExpense, canEditExpense } from "@/lib/expense-permissions";
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

const paymentVoucherItemSchema = z.object({
  itemName: z.string().min(1),
  categoryId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const updateExpenseSchema = z.object({
  purchasedDate: z.coerce.date().optional(),
  companyName: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  fsNumber: z.string().min(1).optional(),
  mrcNumber: z.string().trim().optional(),
  invoiceNumber: z.string().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  items: z.array(expenseItemSchema).min(1).optional(),
});

const updatePaymentVoucherSchema = z.object({
  purchasedDate: z.coerce.date().optional(),
  paidTo: z.string().min(1).optional(),
  tinNumber: z.string().optional(),
  invoiceNumber: z.string().min(1).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  items: z.array(paymentVoucherItemSchema).min(1).optional(),
});

const updateGeneralExpenseSchema = z.object({
  paymentDate: z.coerce.date().optional(),
  paidTo: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  checkNumber: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  categoryId: z.string().min(1).optional(),
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

export async function PUT(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;
    const body = await request.json();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const base = await prisma.expenseBase.findUnique({
      where: { id },
      select: {
        id: true,
        expenseType: true,
        createdByUserId: true,
        organizationId: true,
        status: true,
        isActive: true,
      },
    });

    if (
      !base ||
      base.organizationId !== session.organizationId ||
      !base.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && base.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (
      session.role === "STAFF" &&
      !canEditExpense({ role: session.role, status: base.status })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.role === "ORG_ADMIN" &&
      !canEditExpense({ role: session.role, status: base.status })
    ) {
      return NextResponse.json(
        { error: "Cannot edit a finalized expense" },
        { status: 400 },
      );
    }

    if (base.expenseType !== "RECEIPT") {
      if (base.expenseType === "PAYMENT_VOUCHER") {
        const data = updatePaymentVoucherSchema.parse(body);

        const voucher = await prisma.paymentVoucherExpense.findUnique({
          where: { expenseBaseId: id },
          select: {
            id: true,
            purchasedDate: true,
            paidTo: true,
            tinNumber: true,
            invoiceNumber: true,
            paymentMethod: true,
            checkNumber: true,
            bankAccountId: true,
            totalAmount: true,
            items: {
              select: {
                id: true,
                itemName: true,
                categoryId: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
        });

        if (!voucher) {
          return NextResponse.json(
            { error: "Expense not found" },
            { status: 404 },
          );
        }

        const nextPurchasedDate = data.purchasedDate ?? voucher.purchasedDate;
        const nextPaidTo = data.paidTo ?? voucher.paidTo;
        const nextTinNumber =
          data.tinNumber !== undefined
            ? data.tinNumber || null
            : voucher.tinNumber;
        const nextInvoiceNumber = data.invoiceNumber ?? voucher.invoiceNumber;
        const nextPaymentMethod = data.paymentMethod ?? voucher.paymentMethod;

        const nextCheckNumber =
          data.checkNumber !== undefined
            ? data.checkNumber?.trim() || null
            : voucher.checkNumber;

        const nextBankAccountId =
          data.bankAccountId !== undefined
            ? data.bankAccountId?.trim() || null
            : voucher.bankAccountId;

        if (nextPaymentMethod === "CHECK") {
          if (!nextCheckNumber) {
            return NextResponse.json(
              { error: "Check number is required" },
              { status: 400 },
            );
          }
        }

        if (nextPaymentMethod === "BANK_TRANSFER") {
          if (!nextBankAccountId) {
            return NextResponse.json(
              { error: "Bank account is required" },
              { status: 400 },
            );
          }

          const found = await prisma.bankAccount.findFirst({
            where: {
              id: nextBankAccountId,
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

        const itemsInput = data.items;
        const normalizedItems = (itemsInput ?? voucher.items).map(
          (it: any) => ({
            itemName: it.itemName,
            categoryId: it.categoryId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          }),
        );

        const computedItems = normalizedItems.map((it: any) => {
          const lineTotal = round2(it.quantity * it.unitPrice);
          return { ...it, lineTotal };
        });

        const totalAmount = round2(
          computedItems.reduce((sum, it) => sum + it.lineTotal, 0),
        );

        const updated = await prisma.$transaction(async (tx) => {
          if (itemsInput) {
            await tx.paymentVoucherItem.deleteMany({
              where: { paymentVoucherId: voucher.id },
            });
          }

          const updatedVoucher = await tx.paymentVoucherExpense.update({
            where: { expenseBaseId: id },
            data: {
              purchasedDate: nextPurchasedDate,
              paidTo: nextPaidTo,
              tinNumber: nextTinNumber,
              invoiceNumber: nextInvoiceNumber,
              paymentMethod: nextPaymentMethod,
              checkNumber:
                nextPaymentMethod === "CHECK"
                  ? (nextCheckNumber ?? null)
                  : null,
              bankAccountId:
                nextPaymentMethod === "BANK_TRANSFER"
                  ? (nextBankAccountId ?? null)
                  : null,
              totalAmount: new Prisma.Decimal(totalAmount),
              ...(itemsInput
                ? {
                    items: {
                      create: computedItems.map((it) => ({
                        itemName: it.itemName,
                        categoryId: it.categoryId,
                        quantity: new Prisma.Decimal(it.quantity),
                        unitPrice: new Prisma.Decimal(it.unitPrice),
                        lineTotal: new Prisma.Decimal(it.lineTotal),
                      })),
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              purchasedDate: true,
              paidTo: true,
              tinNumber: true,
              invoiceNumber: true,
              paymentMethod: true,
              checkNumber: true,
              bankAccountId: true,
              totalAmount: true,
            },
          });

          await tx.activityLog.create({
            data: {
              userId: session.id,
              organizationId: session.organizationId,
              actionType: "EXPENSE_UPDATED",
              entityType: "Expense",
              entityId: base.id,
              previousValue: Prisma.JsonNull,
              newValue: Prisma.JsonNull,
            },
          });

          return updatedVoucher;
        });

        return NextResponse.json({
          expense: {
            ...updated,
            id: base.id,
            status: base.status,
            expenseType: "PAYMENT_VOUCHER",
          },
        });
      }

      const data = updateGeneralExpenseSchema.parse(body);

      const general = await prisma.generalExpense.findUnique({
        where: { expenseBaseId: id },
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

      if (!general) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 },
        );
      }

      const nextPaymentDate = data.paymentDate ?? general.paymentDate;
      const nextPaidTo = data.paidTo ?? general.paidTo;
      const nextDescription = data.description ?? general.description;
      const nextAmount = data.amount ?? Number(general.amount);
      const nextPaymentMethod = data.paymentMethod ?? general.paymentMethod;
      const nextCategoryId = data.categoryId ?? general.categoryId;

      const nextCheckNumber =
        data.checkNumber !== undefined
          ? data.checkNumber?.trim() || null
          : general.checkNumber;

      const nextBankAccountId =
        data.bankAccountId !== undefined
          ? data.bankAccountId?.trim() || null
          : general.bankAccountId;

      if (nextPaymentMethod === "CHECK") {
        if (!nextCheckNumber) {
          return NextResponse.json(
            { error: "Check number is required" },
            { status: 400 },
          );
        }
      }

      if (nextPaymentMethod === "BANK_TRANSFER") {
        if (!nextBankAccountId) {
          return NextResponse.json(
            { error: "Bank account is required" },
            { status: 400 },
          );
        }

        const found = await prisma.bankAccount.findFirst({
          where: {
            id: nextBankAccountId,
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

      const updated = await prisma.$transaction(async (tx) => {
        const updatedGeneral = await tx.generalExpense.update({
          where: { expenseBaseId: id },
          data: {
            paymentDate: nextPaymentDate,
            paidTo: nextPaidTo,
            description: nextDescription,
            amount: new Prisma.Decimal(nextAmount),
            paymentMethod: nextPaymentMethod,
            checkNumber:
              nextPaymentMethod === "CHECK" ? (nextCheckNumber ?? null) : null,
            bankAccountId:
              nextPaymentMethod === "BANK_TRANSFER"
                ? (nextBankAccountId ?? null)
                : null,
            categoryId: nextCategoryId,
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
            organizationId: session.organizationId,
            actionType: "EXPENSE_UPDATED",
            entityType: "Expense",
            entityId: base.id,
            previousValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        });

        return updatedGeneral;
      });

      return NextResponse.json({
        expense: {
          ...updated,
          id: base.id,
          status: base.status,
          expenseType: "GENERAL",
        },
      });
    }

    const data = updateExpenseSchema.parse(body);

    const expense = await prisma.receiptExpense.findUnique({
      where: { expenseBaseId: id },
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
        items: {
          select: {
            id: true,
            itemName: true,
            categoryId: true,
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

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
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

    if (!nextMrcNumber) {
      return NextResponse.json(
        { error: "MRC number is required" },
        { status: 400 },
      );
    }

    const nextCheckNumber =
      data.checkNumber !== undefined
        ? data.checkNumber?.trim() || null
        : expense.checkNumber;

    const nextBankAccountId =
      data.bankAccountId !== undefined
        ? data.bankAccountId?.trim() || null
        : expense.bankAccountId;

    if (nextPaymentMethod === "CHECK") {
      if (!nextCheckNumber) {
        return NextResponse.json(
          { error: "Check number is required" },
          { status: 400 },
        );
      }
    }

    if (nextPaymentMethod === "BANK_TRANSFER") {
      if (!nextBankAccountId) {
        return NextResponse.json(
          { error: "Bank account is required" },
          { status: 400 },
        );
      }

      const found = await prisma.bankAccount.findFirst({
        where: {
          id: nextBankAccountId,
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
        normalizedItems.map((it: any) => it.unitOfMeasureId).filter(Boolean),
      ),
    ) as string[];
    const purchaseTypeIds = Array.from(
      new Set(
        normalizedItems.map((it: any) => it.purchaseTypeId).filter(Boolean),
      ),
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

    const computedItems = normalizedItems.map((it: any) => {
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const lineTotal = round2(qty * unitPrice);
      return {
        itemName: it.itemName,
        subcategoryId: it.subcategoryId ?? it.categoryId,
        vatCategory: it.vatCategory,
        quantity: qty,
        unitPrice,
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
      organizationId: session.organizationId,
      items: computedItems.map((it) => ({
        subcategoryId: it.subcategoryId,
        lineTotal: it.lineTotal,
      })),
    });

    const status: ExpenseStatus = anyViolated ? "WARNING" : "PENDING";

    const previousExpense = await prisma.receiptExpense.findUnique({
      where: { expenseBaseId: id },
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
      checkNumber: previousExpense.checkNumber,
      bankAccountId: previousExpense.bankAccountId,
      subtotal:
        previousExpense.subtotal?.toString?.() ??
        String(previousExpense.subtotal),
      vat: previousExpense.vat?.toString?.() ?? String(previousExpense.vat),
      total:
        previousExpense.total?.toString?.() ?? String(previousExpense.total),
      status: base.status,
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (itemsInput) {
        await tx.receiptExpenseItem.deleteMany({
          where: { receiptExpenseId: expense.id },
        });
      }

      const updatedExpense = await tx.receiptExpense.update({
        where: { expenseBaseId: id },
        data: {
          purchasedDate: nextPurchasedDate,
          companyName: nextCompanyName,
          tinNumber: nextTinNumber,
          fsNumber: nextFsNumber,
          mrcNumber: nextMrcNumber,
          invoiceNumber: nextInvoiceNumber,
          paymentMethod: nextPaymentMethod,
          checkNumber: nextPaymentMethod === "CHECK" ? nextCheckNumber : null,
          bankAccountId:
            nextPaymentMethod === "BANK_TRANSFER" ? nextBankAccountId : null,
          subtotal: new Prisma.Decimal(subtotal),
          vat: new Prisma.Decimal(vat),
          total: new Prisma.Decimal(total),
          ...(itemsInput
            ? {
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
          checkNumber: true,
          bankAccountId: true,
          subtotal: true,
          vat: true,
          total: true,
        },
      });

      const updatedBase = await tx.expenseBase.update({
        where: { id },
        data: { status },
        select: { id: true, status: true },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "EXPENSE_UPDATED",
          entityType: "Expense",
          entityId: updatedBase.id,
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
            checkNumber: updatedExpense.checkNumber,
            bankAccountId: updatedExpense.bankAccountId,
            subtotal:
              updatedExpense.subtotal?.toString?.() ??
              String(updatedExpense.subtotal),
            vat: updatedExpense.vat?.toString?.() ?? String(updatedExpense.vat),
            total:
              updatedExpense.total?.toString?.() ??
              String(updatedExpense.total),
            status: updatedBase.status,
          },
        },
      });

      return { updatedExpense, updatedBase };
    });

    return NextResponse.json({
      expense: {
        ...updated.updatedExpense,
        id: updated.updatedBase.id,
        status: updated.updatedBase.status,
        expenseType: "RECEIPT",
      },
    });
  } catch (error) {
    console.error(" Update expense error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
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
        { status: 400 },
      );
    }

    // Backward-compatibility: older clients sometimes navigated using the subtype table id
    // (ReceiptExpense/PaymentVoucherExpense/GeneralExpense) instead of ExpenseBase.id.
    // Resolve to ExpenseBase.id when necessary.
    let resolvedExpenseBaseId: string = id;
    const directBase = await prisma.expenseBase.findUnique({
      where: { id: resolvedExpenseBaseId },
      select: { id: true },
    });
    if (!directBase) {
      const legacyReceipt = await prisma.receiptExpense.findUnique({
        where: { id },
        select: { expenseBaseId: true },
      });
      const legacyVoucher = legacyReceipt
        ? null
        : await prisma.paymentVoucherExpense.findUnique({
            where: { id },
            select: { expenseBaseId: true },
          });
      const legacyGeneral =
        legacyReceipt || legacyVoucher
          ? null
          : await prisma.generalExpense.findUnique({
              where: { id },
              select: { expenseBaseId: true },
            });

      const foundBaseId =
        legacyReceipt?.expenseBaseId ??
        legacyVoucher?.expenseBaseId ??
        legacyGeneral?.expenseBaseId;

      if (foundBaseId) {
        resolvedExpenseBaseId = foundBaseId;
      }
    }

    const expense = await prisma.expenseBase.findUnique({
      where: { id: resolvedExpenseBaseId },
      select: {
        id: true,
        expenseType: true,
        status: true,
        createdAt: true,
        createdByUserId: true,
        organizationId: true,
        isActive: true,
        createdBy: { select: { id: true, name: true, email: true } },
        receiptExpense: {
          select: {
            purchasedDate: true,
            companyName: true,
            tinNumber: true,
            fsNumber: true,
            mrcNumber: true,
            invoiceNumber: true,
            paymentMethod: true,
            checkNumber: true,
            bankAccountId: true,
            bankAccount: {
              select: {
                id: true,
                bankName: true,
                accountHolderName: true,
                accountNumber: true,
                isActive: true,
              },
            },
            subtotal: true,
            vat: true,
            total: true,
            items: {
              select: {
                id: true,
                itemName: true,
                categoryId: true,
                vatCategory: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
                unitOfMeasureId: true,
                purchaseTypeId: true,
                hasPolicyViolation: true,
                category: { select: { id: true, name: true, type: true } },
                unitOfMeasure: {
                  select: { id: true, label: true, code: true },
                },
                purchaseType: { select: { id: true, label: true, code: true } },
              },
              orderBy: { id: "asc" },
            },
          },
        },
        paymentVoucherExpense: {
          select: {
            purchasedDate: true,
            paidTo: true,
            tinNumber: true,
            invoiceNumber: true,
            paymentMethod: true,
            checkNumber: true,
            bankAccountId: true,
            bankAccount: {
              select: {
                id: true,
                bankName: true,
                accountHolderName: true,
                accountNumber: true,
                isActive: true,
              },
            },
            totalAmount: true,
            items: {
              select: {
                id: true,
                itemName: true,
                categoryId: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
                category: { select: { id: true, name: true } },
              },
              orderBy: { id: "asc" },
            },
          },
        },
        generalExpense: {
          select: {
            paymentDate: true,
            paidTo: true,
            description: true,
            amount: true,
            paymentMethod: true,
            checkNumber: true,
            bankAccountId: true,
            bankAccount: {
              select: {
                id: true,
                bankName: true,
                accountHolderName: true,
                accountNumber: true,
                isActive: true,
              },
            },
            categoryId: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (
      !expense ||
      expense.organizationId !== session.organizationId ||
      !expense.isActive
    ) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (expense.expenseType === "RECEIPT" && expense.receiptExpense) {
      const mappedItems = expense.receiptExpense.items.map((it) => ({
        ...it,
        subcategoryId: it.categoryId,
        subcategory: it.category,
      }));

      return NextResponse.json({
        expense: {
          id: expense.id,
          expenseType: expense.expenseType,
          purchasedDate: expense.receiptExpense.purchasedDate,
          companyName: expense.receiptExpense.companyName,
          tinNumber: expense.receiptExpense.tinNumber,
          fsNumber: expense.receiptExpense.fsNumber,
          mrcNumber: expense.receiptExpense.mrcNumber,
          invoiceNumber: expense.receiptExpense.invoiceNumber,
          paymentMethod: expense.receiptExpense.paymentMethod,
          checkNumber: expense.receiptExpense.checkNumber,
          bankAccountId: expense.receiptExpense.bankAccountId,
          bankAccount: expense.receiptExpense.bankAccount,
          subtotal: expense.receiptExpense.subtotal,
          vat: expense.receiptExpense.vat,
          total: expense.receiptExpense.total,
          status: expense.status,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
          items: mappedItems,
        },
      });
    }

    if (
      expense.expenseType === "PAYMENT_VOUCHER" &&
      expense.paymentVoucherExpense
    ) {
      return NextResponse.json({
        expense: {
          id: expense.id,
          expenseType: expense.expenseType,
          purchasedDate: expense.paymentVoucherExpense.purchasedDate,
          paidTo: expense.paymentVoucherExpense.paidTo,
          tinNumber: expense.paymentVoucherExpense.tinNumber,
          invoiceNumber: expense.paymentVoucherExpense.invoiceNumber,
          paymentMethod: expense.paymentVoucherExpense.paymentMethod,
          checkNumber: expense.paymentVoucherExpense.checkNumber,
          bankAccountId: expense.paymentVoucherExpense.bankAccountId,
          bankAccount: expense.paymentVoucherExpense.bankAccount,
          totalAmount: expense.paymentVoucherExpense.totalAmount,
          status: expense.status,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
          items: expense.paymentVoucherExpense.items,
        },
      });
    }

    if (expense.expenseType === "GENERAL" && expense.generalExpense) {
      return NextResponse.json({
        expense: {
          id: expense.id,
          expenseType: expense.expenseType,
          paymentDate: expense.generalExpense.paymentDate,
          paidTo: expense.generalExpense.paidTo,
          description: expense.generalExpense.description,
          amount: expense.generalExpense.amount,
          paymentMethod: expense.generalExpense.paymentMethod,
          checkNumber: expense.generalExpense.checkNumber,
          bankAccountId: expense.generalExpense.bankAccountId,
          bankAccount: expense.generalExpense.bankAccount,
          categoryId: expense.generalExpense.categoryId,
          category: expense.generalExpense.category,
          status: expense.status,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
        },
      });
    }

    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  } catch (error) {
    console.error(" Get expense detail error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
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
        { status: 400 },
      );
    }

    const expense = await prisma.expenseBase.findUnique({
      where: { id },
      select: {
        id: true,
        createdByUserId: true,
        organizationId: true,
        status: true,
        isActive: true,
        expenseType: true,
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (session.role === "STAFF" && expense.createdByUserId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (
      session.role === "STAFF" &&
      !canDeleteExpense({ role: session.role, status: expense.status })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.role === "ORG_ADMIN" &&
      !canDeleteExpense({ role: session.role, status: expense.status })
    ) {
      return NextResponse.json(
        { error: "Cannot delete a finalized expense" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.expenseBase.update({
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
    console.error(" Delete expense error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
