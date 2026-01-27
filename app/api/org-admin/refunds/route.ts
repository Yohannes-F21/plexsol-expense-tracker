import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const ERRORS = {
  MISSING_ORG: "Organization ID missing",
} as const;

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const orgId = session.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const refunds = await prisma.refund.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        remark: true,
        rejectionReason: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        requesterId: true,
        requester: { select: { id: true, name: true, email: true } },
        fromAccount: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            balance: true,
          },
        },
        toAccount: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            balance: true,
          },
        },
      },
    });

    return NextResponse.json({ refunds });
  } catch (error) {
    console.error("[v0] List refunds error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const methodNotAllowed = NextResponse.json(
    { error: "Not supported. Create refunds via staff endpoint." },
    { status: 405 },
  );

  // Explicitly disallow creation from org-admin route in the new workflow
  return methodNotAllowed;
}
