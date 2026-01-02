import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updatePurchaseTypeSchema = z.object({
  label: z.coerce.number().int().positive(),
  code: z.string().min(1),
});

const setPurchaseTypeActiveSchema = z.object({
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
    const data = updatePurchaseTypeSchema.parse(body);

    const existing = await prisma.purchaseType.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Purchase type not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: "Cannot update an inactive purchase type" },
        { status: 400 }
      );
    }

    const duplicate = await prisma.purchaseType.findFirst({
      where: {
        organizationId: orgId,
        code: { equals: data.code, mode: "insensitive" },
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "A purchase type with this name already exists." },
        { status: 409 }
      );
    }

    const purchaseType = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseType.update({
        where: { id },
        data: { label: data.label, code: data.code },
        select: {
          id: true,
          label: true,
          code: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "PURCHASE_TYPE_UPDATED",
          entityType: "PurchaseType",
          entityId: updated.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, purchaseType });
  } catch (error) {
    console.error("[v0] Update purchase type error:", error);

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
        { error: "A purchase type with this code already exists." },
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

    const existing = await prisma.purchaseType.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Purchase type not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseType.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "PURCHASE_TYPE_DELETED",
          entityType: "PurchaseType",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Delete purchase type error:", error);
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
    const data = setPurchaseTypeActiveSchema.parse(body);

    const existing = await prisma.purchaseType.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Purchase type not found" },
        { status: 404 }
      );
    }

    if (existing.isActive === data.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseType.update({
        where: { id },
        data: { isActive: data.isActive },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: data.isActive
            ? "PURCHASE_TYPE_ACTIVATED"
            : "PURCHASE_TYPE_DEACTIVATED",
          entityType: "PurchaseType",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Set purchase type active error:", error);

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
