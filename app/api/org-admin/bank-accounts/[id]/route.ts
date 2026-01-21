import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(1),
});

const setBankAccountActiveSchema = z.object({
  isActive: z.boolean(),
});

export async function PUT(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateBankAccountSchema.parse(body);

    const existing = await prisma.bankAccount.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: "Cannot update an inactive bank account" },
        { status: 400 }
      );
    }

    const accountNumberDuplicate = await prisma.bankAccount.findFirst({
      where: {
        organizationId: orgId,
        accountNumber: { equals: data.accountNumber, mode: "insensitive" },
        NOT: { id },
      },
      select: { id: true },
    });

    if (accountNumberDuplicate) {
      return NextResponse.json(
        { error: "A bank account with this account number already exists." },
        { status: 409 }
      );
    }

    const bankAccount = await prisma.$transaction(async (tx) => {
      const updated = await tx.bankAccount.update({
        where: { id },
        data: {
          bankName: data.bankName,
          accountHolderName: data.accountHolderName,
          accountNumber: data.accountNumber,
        },
        select: {
          id: true,
          bankName: true,
          accountHolderName: true,
          accountNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "BANK_ACCOUNT_UPDATED",
          entityType: "BankAccount",
          entityId: updated.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, bankAccount });
  } catch (error) {
    console.error("[v0] Update bank account error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A bank account with this account number already exists." },
        { status: 409 }
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
    const session = await requireRole(["ORG_ADMIN"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const existing = await prisma.bankAccount.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.update({ where: { id }, data: { isActive: false } });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "BANK_ACCOUNT_DELETED",
          entityType: "BankAccount",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Delete bank account error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = setBankAccountActiveSchema.parse(body);

    const existing = await prisma.bankAccount.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    if (existing.isActive === data.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.update({
        where: { id },
        data: { isActive: data.isActive },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: data.isActive
            ? "BANK_ACCOUNT_ACTIVATED"
            : "BANK_ACCOUNT_DEACTIVATED",
          entityType: "BankAccount",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Set bank account active error:", error);

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
