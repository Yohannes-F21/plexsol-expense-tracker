import { NextResponse } from "next/server"
import { deleteSession } from "@/lib/auth"

export async function POST() {
  try {
    await deleteSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Signout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
