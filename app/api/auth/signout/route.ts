import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

function getSafeNextPath(value: string | null): string {
  if (!value) return "/signin";
  // Only allow same-origin relative redirects.
  if (!value.startsWith("/")) return "/signin";
  if (value.startsWith("//")) return "/signin";
  if (value.includes("\\")) return "/signin";
  return value;
}

export async function GET(request: Request) {
  try {
    await deleteSession();
    const url = new URL(request.url);
    const nextPath = getSafeNextPath(url.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.redirect(new URL("/signin", request.url));
  }
}

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
