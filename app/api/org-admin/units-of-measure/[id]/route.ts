import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUnitSchema = z.object({
  label: z.coerce.number().int().positive(),
  code: z.string().min(1),
});

const setUnitActiveSchema = z.object({
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
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = updateUnitSchema.parse(body);

    const existing = await prisma.unitOfMeasure.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: "Cannot update an inactive unit" },
        { status: 400 },
      );
    }

    const labelDuplicate = await prisma.unitOfMeasure.findFirst({
      where: {
        organizationId: orgId,
        label: data.label,
        NOT: { id },
      },
      select: { id: true },
    });

    if (labelDuplicate) {
      return NextResponse.json(
        { error: "A unit with this label already exists." },
        { status: 409 },
      );
    }

    const codeDuplicate = await prisma.unitOfMeasure.findFirst({
      where: {
        organizationId: orgId,
        code: { equals: data.code, mode: "insensitive" },
        NOT: { id },
      },
      select: { id: true },
    });

    if (codeDuplicate) {
      return NextResponse.json(
        { error: "A unit with this code already exists." },
        { status: 409 },
      );
    }

    const unit = await prisma.$transaction(async (tx) => {
      const updated = await tx.unitOfMeasure.update({
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
          actionType: "UNIT_OF_MEASURE_UPDATED",
          entityType: "UnitOfMeasure",
          entityId: updated.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, unit });
  } catch (error) {
    console.error("Update unit of measure error:", error);

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
        { error: "A unit with this code already exists." },
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
        { status: 400 },
      );
    }

    const existing = await prisma.unitOfMeasure.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.unitOfMeasure.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "UNIT_OF_MEASURE_DELETED",
          entityType: "UnitOfMeasure",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete unit of measure error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
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
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = setUnitActiveSchema.parse(body);

    const existing = await prisma.unitOfMeasure.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (existing.isActive === data.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.unitOfMeasure.update({
        where: { id },
        data: { isActive: data.isActive },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: data.isActive
            ? "UNIT_OF_MEASURE_ACTIVATED"
            : "UNIT_OF_MEASURE_DEACTIVATED",
          entityType: "UnitOfMeasure",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set unit of measure active error:", error);

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
