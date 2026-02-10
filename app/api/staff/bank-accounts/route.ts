import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bankName: true,
        accountHolderName: true,
        accountNumber: true,
        balance: true,
        initialBalance: true,
      },
    });

    return NextResponse.json({ bankAccounts });
  } catch (error) {
    console.error("Staff bank accounts error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
