import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"])

    if (!session.organizationId) {
      return NextResponse.json({ error: "Organization ID missing" }, { status: 400 })
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        invitedAt: "desc",
      },
    })

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error("[v0] Get invitations error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
