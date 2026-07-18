import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { handleError, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/runs/:id — run detail with its full receipt chain.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const store = getStore();
    const run = await store.getRun(id);
    if (!run) return jsonError("run_not_found", 404);
    const receipts = await store.listReceipts(id);
    return NextResponse.json({ run, receipts });
  } catch (err) {
    return handleError(err);
  }
}
