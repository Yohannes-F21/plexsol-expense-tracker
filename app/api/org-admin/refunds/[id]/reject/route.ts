import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Rejection reason is required"),
});

const ERRORS = {
  MISSING_ORG: "Organization ID missing",
  NOT_FOUND: "Refund not found",
  NOT_PENDING: "Refund already finalized",
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const { id } = await params;

    if (!session.organizationId) {
      return NextResponse.json({ error: ERRORS.MISSING_ORG }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const data = rejectSchema.parse(body);

    const refund = await prisma.refund.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!refund || refund.organizationId !== session.organizationId) {
      return NextResponse.json({ error: ERRORS.NOT_FOUND }, { status: 404 });
    }

    if (refund.status !== "PENDING") {
      return NextResponse.json({ error: ERRORS.NOT_PENDING }, { status: 400 });
    }

    const updatedRefund = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: "REJECTED",
        rejectionReason: data.rejectionReason,
        rejectedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        rejectedAt: true,
      },
    });

    return NextResponse.json({ refund: updatedRefund });
  } catch (error) {
    console.error("Reject refund error:", error);

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
