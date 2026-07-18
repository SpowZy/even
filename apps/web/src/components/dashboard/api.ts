import type { ChainVerification, Receipt, Run } from "@even/core";

export interface RunDetail {
  run: Run;
  receipts: Receipt[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`.trim());
    this.name = "ApiError";
    this.status = status;
  }
}

function expectOk(res: Response): Response {
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res;
}

export async function fetchRuns(): Promise<Run[]> {
  const res = expectOk(await fetch("/api/runs", { cache: "no-store" }));
  return (await res.json()) as Run[];
}

export async function fetchRunDetail(runId: string): Promise<RunDetail> {
  const res = expectOk(await fetch(`/api/runs/${runId}`, { cache: "no-store" }));
  return (await res.json()) as RunDetail;
}

export async function fetchVerify(runId: string): Promise<ChainVerification> {
  const res = expectOk(
    await fetch(`/api/runs/${runId}/verify`, { cache: "no-store" }),
  );
  return (await res.json()) as ChainVerification;
}

const DEMO_HEADERS = {
  authorization: "Bearer dev-token",
  "content-type": "application/json",
};

export async function seedDemoRun(): Promise<Run> {
  const res = expectOk(
    await fetch("/api/demo/seed", { method: "POST", headers: DEMO_HEADERS }),
  );
  const body = (await res.json()) as { run: Run };
  return body.run;
}

export async function tamperRun(runId: string): Promise<number> {
  const res = expectOk(
    await fetch("/api/demo/tamper", {
      method: "POST",
      headers: DEMO_HEADERS,
      body: JSON.stringify({ runId }),
    }),
  );
  const body = (await res.json()) as { tamperedSeq: number };
  return body.tamperedSeq;
}

export function exportCsvUrl(runId: string): string {
  return `/api/runs/${runId}/export.csv`;
}
