import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { handleError, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// GET /api/runs/:id/export.csv — CFO-grade cost report: calls, tokens and
// spend per tool, plus a TOTAL row. What did this agent do, and what did
// it cost?
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const store = getStore();
    const run = await store.getRun(id);
    if (!run) return jsonError("run_not_found", 404);
    const receipts = await store.listReceipts(id);

    const byTool = new Map<
      string,
      { calls: number; inputTokens: number; outputTokens: number; usd: number }
    >();
    for (const r of receipts) {
      const row = byTool.get(r.action.tool) ?? {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        usd: 0,
      };
      row.calls += 1;
      row.inputTokens += r.cost.inputTokens;
      row.outputTokens += r.cost.outputTokens;
      row.usd += r.cost.usd;
      byTool.set(r.action.tool, row);
    }

    const lines = ["tool,calls,input_tokens,output_tokens,usd"];
    let totalCalls = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalUsd = 0;
    for (const [tool, row] of [...byTool.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
      lines.push(
        [csvCell(tool), row.calls, row.inputTokens, row.outputTokens, row.usd.toFixed(6)].join(","),
      );
      totalCalls += row.calls;
      totalInput += row.inputTokens;
      totalOutput += row.outputTokens;
      totalUsd += row.usd;
    }
    lines.push(["TOTAL", totalCalls, totalInput, totalOutput, totalUsd.toFixed(6)].join(","));

    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="even-${id}.csv"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
