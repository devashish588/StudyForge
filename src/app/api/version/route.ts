import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Use git HEAD at build time if available, otherwise runtime fallback.
    // This endpoint exists solely to verify deployment version without guessing.
    const head = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local";
    const branch = process.env.VERCEL_GIT_COMMIT_REF || "local";
    return NextResponse.json({
      head: head.slice(0, 7),
      fullHead: head,
      branch,
      builtAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "version unavailable" }, { status: 500 });
  }
}
