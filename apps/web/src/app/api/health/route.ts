import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/health — liveness probe. Fully implemented.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "even",
    version: process.env.npm_package_version ?? "0.1.0",
    time: new Date().toISOString(),
  });
}
