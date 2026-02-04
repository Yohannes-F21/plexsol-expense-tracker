import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUnitSchema = z.object({
  label: z.coerce.number().int().positive(),
  code: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const parsedLabel = q ? Number(q) : NaN;
    const labelFilter = Number.isInteger(parsedLabel) ? parsedLabel : null;

    const units = await prisma.unitOfMeasure.findMany({
      where: {
        organizationId: orgId,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                ...(labelFilter !== null ? [{ label: labelFilter }] : []),
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { label: "asc" }, { code: "asc" }],
      select: {
        id: true,
        label: true,
        code: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, units });
  } catch (error) {
    console.error("List units of measure error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = createUnitSchema.parse(body);

    const labelDuplicate = await prisma.unitOfMeasure.findFirst({
      where: {
        organizationId: orgId,
        label: data.label,
      },
      select: { id: true, isActive: true },
    });

    if (labelDuplicate) {
      if (!labelDuplicate.isActive) {
        return NextResponse.json(
          { error: "A unit with this label already exists but is inactive." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "A unit with this label already exists." },
        { status: 409 },
      );
    }

    const codeDuplicate = await prisma.unitOfMeasure.findFirst({
      where: {
        organizationId: orgId,
        code: { equals: data.code, mode: "insensitive" },
      },
      select: { id: true, isActive: true },
    });

    if (codeDuplicate) {
      if (!codeDuplicate.isActive) {
        return NextResponse.json(
          { error: "A unit with this code already exists but is inactive." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "A unit with this code already exists." },
        { status: 409 },
      );
    }

    const unit = await prisma.$transaction(async (tx) => {
      const created = await tx.unitOfMeasure.create({
        data: {
          organizationId: orgId,
          label: data.label,
          code: data.code,
        },
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
          actionType: "UNIT_OF_MEASURE_CREATED",
          entityType: "UnitOfMeasure",
          entityId: created.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, unit });
  } catch (error) {
    console.error("Create unit of measure error:", error);

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
