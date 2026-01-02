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
        approvedAt: true,
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
      },
    });

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("[org-admin] Get approval detail error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
