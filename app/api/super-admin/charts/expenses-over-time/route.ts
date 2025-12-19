import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"])

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    })

    const monthlyData = new Map<string, { total: number; count: number }>()

    expenses.forEach((expense) => {
      const monthKey = expense.createdAt.toLocaleString("default", {
        month: "short",
        year: "numeric",
      })

      const existing = monthlyData.get(monthKey) || { total: 0, count: 0 }
      monthlyData.set(monthKey, {
        total: existing.total + expense.amount,
        count: existing.count + 1,
      })
    })

    const chartData = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    return NextResponse.json(chartData)
  } catch (error) {
    console.error("[v0] Get expenses chart error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
