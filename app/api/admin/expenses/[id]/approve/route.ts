import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["ORG_ADMIN"])
    const { id } = await params

    const expense = await prisma.expense.findUnique({
      where: { id },
    })

    if (!expense || expense.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: { status: "APPROVED" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ expense: updatedExpense })
  } catch (error) {
    console.error("[v0] Approve expense error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
