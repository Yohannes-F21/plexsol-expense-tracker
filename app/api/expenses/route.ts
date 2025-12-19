import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const expenseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  date: z.string(),
})

export async function GET() {
  try {
    const session = await requireAuth()

    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.id,
      },
      orderBy: {
        date: "desc",
      },
    })

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error("[v0] Get expenses error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const validatedData = expenseSchema.parse(body)

    if (!session.organizationId) {
      return NextResponse.json({ error: "User not associated with an organization" }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        amount: validatedData.amount,
        date: new Date(validatedData.date),
        userId: session.id,
        organizationId: session.organizationId,
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error("[v0] Create expense error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
