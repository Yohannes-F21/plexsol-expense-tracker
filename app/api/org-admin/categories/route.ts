import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ categories });
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

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    const category = await prisma.category.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        organizationId: session.organizationId,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("[v0] Create category error:", error);
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
