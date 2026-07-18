import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWriteAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { clientIp, handleError, rateLimited } from "@/lib/server/http";
import { tamperDemo } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

const tamperSchema = z.object({ runId: z.string().uuid() });

// POST /api/demo/tamper — flip bytes at rest inside the ledger. The chain
// must go red on the next verification: that is the whole point of even.
export async function POST(req: Request) {
  try {
    requireWriteAuth(req);
    if (!checkRateLimit(`demo-tamper:${clientIp(req)}`, 10, 60_000)) return rateLimited();
    const { runId } = tamperSchema.parse(await req.json());
    const result = await tamperDemo(runId);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
