import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

function toPrismaCategoryType(type: "operational" | "administrative") {
  return type === "operational" ? "OPERATIONAL" : "ADMINISTRATIVE";
}

function toApiCategoryType(type: string) {
  return type === "OPERATIONAL" ? "operational" : "administrative";
}

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const organizationId = session.organizationId;

    const categories = await prisma.category.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        ...c,
        type: toApiCategoryType(c.type),
      })),
    });
  } catch (error) {
    console.error("[v0] Get categories error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["operational", "administrative"]),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const organizationId = session.organizationId;

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    const prismaType = toPrismaCategoryType(validatedData.type);

    const duplicate = await prisma.category.findFirst({
      where: {
        organizationId,
        type: prismaType,
        name: { equals: validatedData.name, mode: "insensitive" },
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
      const created = await tx.category.create({
        data: {
          name: validatedData.name,
          type: prismaType,
          description: validatedData.description,
          organizationId,
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
          organizationId,
          actionType: "CATEGORY_CREATED",
          entityType: "Category",
          entityId: created.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      category: {
        ...category,
        type: toApiCategoryType(category.type),
      },
    });
  } catch (error) {
    console.error("[v0] Create category error:", error);
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
