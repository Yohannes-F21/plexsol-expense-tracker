import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  policyName: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  maxAmount: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const { id: policyId } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const policy = await prisma.expensePolicy.findFirst({
      where: { id: policyId, organizationId: session.organizationId },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const updated = await prisma.expensePolicy.update({
      where: { id: policyId },
      data: {
        ...(data.policyName && { policyName: data.policyName }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.maxAmount !== undefined && { maxAmount: data.maxAmount }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.categoryId && { allowedCategories: [data.categoryId] }),
      },
    });

    return NextResponse.json({ policy: updated });
  } catch (error) {
    console.error("Update policy error:", error);
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const { id: policyId } = await params;
    const policy = await prisma.expensePolicy.findFirst({
      where: { id: policyId, organizationId: session.organizationId },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    await prisma.expensePolicy.update({
      where: { id: policyId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete policy error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
