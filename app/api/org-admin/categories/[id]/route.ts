import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function toPrismaCategoryType(type: "operational" | "administrative") {
  return type === "operational" ? "OPERATIONAL" : "ADMINISTRATIVE";
}

function toApiCategoryType(type: string) {
  return type === "OPERATIONAL" ? "operational" : "administrative";
}

const updateCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["operational", "administrative"]),
  description: z.string().optional(),
});

export async function PUT(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateCategorySchema.parse(body);

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: "Cannot update an inactive category" },
        { status: 400 }
      );
    }

    const prismaType = toPrismaCategoryType(data.type);

    const duplicate = await prisma.category.findFirst({
      where: {
        organizationId: session.organizationId,
        type: prismaType,
        name: { equals: data.name, mode: "insensitive" },
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "A category with this name already exists for the selected type.",
        },
        { status: 409 }
      );
    }

    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          name: data.name,
          type: prismaType,
          description: data.description,
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          isActive: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "CATEGORY_UPDATED",
          entityType: "Category",
          entityId: updated.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      category: {
        ...category,
        type: toApiCategoryType(category.type),
      },
    });
  } catch (error) {
    console.error("[v0] Update category error:", error);
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
        {
          error:
            "A category with this name already exists for the selected type.",
        },
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

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!existing || existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: session.organizationId,
          actionType: "CATEGORY_DELETED",
          entityType: "Category",
          entityId: id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Delete category error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
