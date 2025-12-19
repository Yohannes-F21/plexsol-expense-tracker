import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"])

    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
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
            expenses: true,
          },
        },
        users: {
          where: {
            role: "ORG_ADMIN",
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    console.log("[v0] Fetched organizations:", organizations.length)

    return NextResponse.json(organizations)
  } catch (error) {
    console.error("[v0] Get organizations error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

const createOrgSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const session = await requireRole(["SUPER_ADMIN"])
    const body = await request.json()
    const validatedData = createOrgSchema.parse(body)

    console.log("[v0] Creating organization:", validatedData)

    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        industry: validatedData.industry,
        isActive: true,
        createdById: session.id,
      },
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
            expenses: true,
          },
        },
      },
    })

    console.log("[v0] Organization created:", organization.id)

    return NextResponse.json(organization)
  } catch (error) {
    console.error("[v0] Create organization error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
