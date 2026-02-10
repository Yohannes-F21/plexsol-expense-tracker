import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
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
        expenseType: true,
        status: true,
        approvedAt: true,
        createdAt: true,
        createdByUserId: true,
        organizationId: true,
        isActive: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvalHistory: {
          select: {
            id: true,
            action: true,
            comment: true,
            createdAt: true,
            performedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        receiptExpense: {
          select: {
            purchasedDate: true,
            companyName: true,
            tinNumber: true,
            fsNumber: true,
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
                quantity: true,
                unitPrice: true,
                lineTotal: true,
                hasPolicyViolation: true,
                category: { select: { id: true, name: true, type: true } },
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
            category: { select: { id: true, name: true, type: true } },
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
          invoiceNumber: expense.receiptExpense.invoiceNumber,
          paymentMethod: expense.receiptExpense.paymentMethod,
          checkNumber: expense.receiptExpense.checkNumber,
          bankAccountId: expense.receiptExpense.bankAccountId,
          bankAccount: expense.receiptExpense.bankAccount,
          subtotal: expense.receiptExpense.subtotal,
          vat: expense.receiptExpense.vat,
          total: expense.receiptExpense.total,
          status: expense.status,
          approvedAt: expense.approvedAt,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
          approvalHistory: expense.approvalHistory,
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
          approvedAt: expense.approvedAt,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
          approvalHistory: expense.approvalHistory,
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
          approvedAt: expense.approvedAt,
          createdAt: expense.createdAt,
          createdByUserId: expense.createdByUserId,
          organizationId: expense.organizationId,
          createdByUser: expense.createdBy,
          approvalHistory: expense.approvalHistory,
        },
      });
    }

    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  } catch (error) {
    console.error("[org-admin] Get approval detail error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
