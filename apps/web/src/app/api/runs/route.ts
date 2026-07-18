import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWriteAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { getStore } from "@/lib/server/store";
import { clientIp, handleError, rateLimited } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const createRunSchema = z.object({
  name: z.string().min(1).max(120),
  agent: z.string().min(1).max(120),
  budgetMaxUsd: z.number().positive().max(1_000_000),
});

// POST /api/runs — create a run. The private key is returned exactly once,
// like an API key; the store never persists it.
export async function POST(req: Request) {
  try {
    requireWriteAuth(req);
    if (!checkRateLimit(`runs:${clientIp(req)}`, 30, 60_000)) return rateLimited();
    const body = createRunSchema.parse(await req.json());
    const created = await getStore().createRun(body);
    return NextResponse.json(created, {
      status: 201,
      headers: { "X-Even-Key-Notice": "store-this-key" },
    });
  } catch (err) {
    return handleError(err);
  }
}

// GET /api/runs — every run, newest first.
export async function GET() {
  const runs = await getStore().listRuns();
  return NextResponse.json(
    [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
}
