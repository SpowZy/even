import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { handleError, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/runs/:id/verify — fresh walk of the whole chain: seq contiguity,
// prevHash linkage, recomputed hashes, ed25519 signatures. First failure
// localizes the exact broken link.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const store = getStore();
    const run = await store.getRun(id);
    if (!run) return jsonError("run_not_found", 404);
    const verification = await store.verifyChain(id);
    return NextResponse.json(verification);
  } catch (err) {
    return handleError(err);
  }
}
