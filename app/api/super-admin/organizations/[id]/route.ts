import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await ctx.params;

    const body = await request.json();
    const { isActive } = patchSchema.parse(body);

    const organization = await prisma.organization.update({
      where: { id },
      data: { isActive },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            expenseBases: true,
          },
        },
      },
    });

    const activeExpenseBasesCount = await prisma.expenseBase.count({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
    });

    // Best-effort activity log (don’t fail request if this errors)
    try {
      await prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId: organization.id,
          actionType: isActive
            ? "ORGANIZATION_ACTIVATED"
            : "ORGANIZATION_DEACTIVATED",
          entityType: "Organization",
          entityId: organization.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ...organization,
      activeExpenseBasesCount,
    });
  } catch (error) {
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
