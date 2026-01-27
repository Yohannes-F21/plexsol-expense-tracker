import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(1),
  initialBalance: z.coerce.number().min(0).optional(),
});

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: orgId },
      orderBy: [
        { isActive: "desc" },
        { bankName: "asc" },
        { accountHolderName: "asc" },
        { accountNumber: "asc" },
      ],
      select: {
        id: true,
        bankName: true,
        accountHolderName: true,
        accountNumber: true,
        initialBalance: true,
        balance: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, bankAccounts });
  } catch (error) {
    console.error("[v0] List bank accounts error:", error);
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
    const session = await requireRole(["ORG_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = createBankAccountSchema.parse(body);

    const initialBalance = new Prisma.Decimal(data.initialBalance ?? 0);

    const accountNumberDuplicate = await prisma.bankAccount.findFirst({
      where: {
        organizationId: orgId,
        accountNumber: { equals: data.accountNumber, mode: "insensitive" },
      },
      select: { id: true, isActive: true },
    });

    if (accountNumberDuplicate) {
      if (!accountNumberDuplicate.isActive) {
        return NextResponse.json(
          {
            error:
              "A bank account with this account number already exists but is inactive.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "A bank account with this account number already exists." },
        { status: 409 },
      );
    }

    const bankAccount = await prisma.$transaction(async (tx) => {
      const created = await tx.bankAccount.create({
        data: {
          organizationId: orgId,
          bankName: data.bankName,
          accountHolderName: data.accountHolderName,
          accountNumber: data.accountNumber,
          initialBalance,
          balance: initialBalance,
        },
        select: {
          id: true,
          bankName: true,
          accountHolderName: true,
          accountNumber: true,
          initialBalance: true,
          balance: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "BANK_ACCOUNT_CREATED",
          entityType: "BankAccount",
          entityId: created.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, bankAccount });
  } catch (error) {
    console.error("[v0] Create bank account error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
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
        { status: 409 },
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
