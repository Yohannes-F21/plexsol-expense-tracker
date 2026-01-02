import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        expenses: {
          where: { isActive: true },
          select: {
            total: true,
          },
        },
      },
    });

    const chartData = organizations
      .map((org) => ({
        name: org.name,
        total: org.expenses.reduce(
          (sum, expense) => sum + asNumber(expense.total),
          0
        ),
        count: org.expenses.length,
      }))
      .filter((org) => org.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("[v0] Get expenses by org chart error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
