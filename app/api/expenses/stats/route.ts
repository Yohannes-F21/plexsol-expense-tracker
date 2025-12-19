import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await requireAuth()

    const [totalExpenses, pendingExpenses, approvedExpenses, rejectedExpenses] = await Promise.all([
      prisma.expense.count({
        where: { userId: session.id },
      }),
      prisma.expense.count({
        where: {
          userId: session.id,
          status: "PENDING",
        },
      }),
      prisma.expense.count({
        where: {
          userId: session.id,
          status: "APPROVED",
        },
      }),
      prisma.expense.count({
        where: {
          userId: session.id,
          status: "REJECTED",
        },
      }),
    ])

    const totalExpenseAmount = await prisma.expense.aggregate({
      where: {
        userId: session.id,
        status: "APPROVED",
      },
      _sum: {
        amount: true,
      },
    })

    return NextResponse.json({
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      totalExpenseAmount: totalExpenseAmount._sum.amount || 0,
    })
  } catch (error) {
    console.error("[v0] Get stats error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
