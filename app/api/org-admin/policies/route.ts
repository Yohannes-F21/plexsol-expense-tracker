import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { formatError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const policies = await prisma.expensePolicy.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error("Get policies error:", formatError(error));
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

const policySchema = z.object({
  policyName: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  maxAmount: z.number().positive(),
  isActive: z.boolean().default(true),
  requiresReceipt: z.boolean().default(false),
  autoApprove: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = policySchema.parse(body);

    const [policy] = await prisma.$transaction([
      prisma.expensePolicy.create({
        data: {
          policyName: validatedData.policyName,
          description: validatedData.description,
          maxAmount: validatedData.maxAmount,
          allowedCategories: [validatedData.categoryId],
          requiresReceipt: validatedData.requiresReceipt,
          autoApprove: validatedData.autoApprove,
          isActive: validatedData.isActive,
          organizationId: session.organizationId,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "POLICY_CREATED",
          entityType: "ExpensePolicy",
          entityId: "",
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      }),
    ]);

    try {
      await prisma.activityLog.updateMany({
        where: { actionType: "POLICY_CREATED", userId: session.id },
        data: { entityId: policy.id },
      });
    } catch (e) {
      console.warn("Failed to update activity log for policy", e);
    }

    return NextResponse.json({ success: true, policy });
  } catch (error) {
    console.error("Create policy error:", error);
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
