import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatError } from "@/lib/utils";

export async function GET() {
  try {
    // Lightweight connectivity check.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: formatError(e),
        adapter: process.env.PRISMA_ADAPTER ?? "auto",
      },
      { status: 500 }
    );
  }
}
