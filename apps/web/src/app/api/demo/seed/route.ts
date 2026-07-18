import { NextResponse } from "next/server";
import { requireWriteAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { clientIp, handleError, rateLimited } from "@/lib/server/http";
import { seedDemo } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

// POST /api/demo/seed — run the scripted finance-ops agent (200 invoices)
// against the in-memory store and broadcast every receipt over SSE.
export async function POST(req: Request) {
  try {
    requireWriteAuth(req);
    if (!checkRateLimit(`demo-seed:${clientIp(req)}`, 10, 60_000)) return rateLimited();
    const { run } = await seedDemo();
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
