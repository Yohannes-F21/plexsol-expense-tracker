import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"])

    const [totalOrganizations, totalUsers, totalExpenses, pendingApprovals] = await Promise.all([
      prisma.organization.count({
        where: { isActive: true },
      }),
      prisma.user.count({
        where: { isActive: true },
      }),
      prisma.expense.count(),
      prisma.expense.count({
        where: { status: "PENDING" },
      }),
    ])

    console.log("[v0] Dashboard stats:", { totalOrganizations, totalUsers, totalExpenses, pendingApprovals })

    return NextResponse.json({
      totalOrganizations,
      totalUsers,
      totalExpenses,
      pendingApprovals,
    })
  } catch (error) {
    console.error("[v0] Get stats error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
