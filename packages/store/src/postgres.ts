import { randomUUID } from "node:crypto";
import pg from "pg";
import { GENESIS_HASH, generateRunKeyPair, verifyReceipts } from "@even/core";
import type { ChainVerification, Receipt, Run, RunStatus } from "@even/core";
import type { CreatedRun, Store } from "./contract.js";
import {
  DuplicateIdempotencyError,
  PrevHashMismatchError,
  RunClosedError,
  RunNotFoundError,
  SeqGapError,
} from "./errors.js";

interface ReceiptRow {
  payload: Receipt;
}

interface RunRow {
  id: string;
  name: string;
  agent: string;
  status: RunStatus;
  started_at: Date;
  ended_at: Date | null;
  max_usd: number;
  spent_usd: number;
  genesis_hash: string;
  public_key: string;
}

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    name: row.name,
    agent: row.agent,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at ? row.ended_at.toISOString() : undefined,
    budget: { maxUsd: row.max_usd, spentUsd: row.spent_usd },
    genesisHash: row.genesis_hash,
    publicKey: row.public_key,
  };
}

/**
 * Production store. Append-only is enforced twice: in the append transaction
 * (SELECT ... FOR UPDATE on the run row serializes writers) and at the
 * database level (a trigger rejects every UPDATE/DELETE on receipts, and
 * UNIQUE(run_id, seq) / UNIQUE(run_id, idempotency_key) backstop the chain
 * and replay invariants). Apply migrations/001_init.sql before use.
 */
export class PostgresStore implements Store {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  async createRun(input: {
    name: string;
    agent: string;
    budgetMaxUsd: number;
  }): Promise<CreatedRun> {
    const { publicKey, privateKey } = generateRunKeyPair();
    const id = randomUUID();
    const result = await this.pool.query<RunRow>(
      `INSERT INTO runs (id, name, agent, status, started_at, max_usd, spent_usd, genesis_hash, public_key)
       VALUES ($1, $2, $3, 'RUNNING', now(), $4, 0, $5, $6)
       RETURNING *`,
      [id, input.name, input.agent, input.budgetMaxUsd, GENESIS_HASH, publicKey],
    );
    return { run: rowToRun(result.rows[0]!), privateKey };
  }

  async getRun(id: string): Promise<Run | null> {
    const result = await this.pool.query<RunRow>("SELECT * FROM runs WHERE id = $1", [id]);
    return result.rows[0] ? rowToRun(result.rows[0]) : null;
  }

  async listRuns(): Promise<Run[]> {
    const result = await this.pool.query<RunRow>("SELECT * FROM runs ORDER BY started_at DESC");
    return result.rows.map(rowToRun);
  }

  async appendReceipt(runId: string, signed: Receipt): Promise<Receipt> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const runResult = await client.query<RunRow>(
        "SELECT * FROM runs WHERE id = $1 FOR UPDATE",
        [runId],
      );
      const runRow = runResult.rows[0];
      if (!runRow) throw new RunNotFoundError(runId);
      if (runRow.status !== "RUNNING") throw new RunClosedError(runId, runRow.status);

      const tailResult = await client.query<{ hash: string }>(
        "SELECT hash FROM receipts WHERE run_id = $1 ORDER BY seq DESC LIMIT 1",
        [runId],
      );
      const expectedSeq = (await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM receipts WHERE run_id = $1",
        [runId],
      )).rows[0]!.count;
      const nextSeq = Number(expectedSeq) + 1;
      if (signed.seq !== nextSeq) throw new SeqGapError(nextSeq, signed.seq);

      const expectedPrev = tailResult.rows[0]?.hash ?? runRow.genesis_hash;
      if (signed.prevHash !== expectedPrev) throw new PrevHashMismatchError(signed.seq);

      const dup = await client.query<{ id: string }>(
        "SELECT id FROM receipts WHERE run_id = $1 AND idempotency_key = $2",
        [runId, signed.idempotencyKey],
      );
      if (dup.rows.length > 0) throw new DuplicateIdempotencyError(signed.idempotencyKey);

      await client.query(
        `INSERT INTO receipts (run_id, seq, id, prev_hash, hash, signature, idempotency_key, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          runId,
          signed.seq,
          signed.id,
          signed.prevHash,
          signed.hash,
          signed.signature,
          signed.idempotencyKey,
          JSON.stringify(signed),
        ],
      );
      await client.query("COMMIT");
      return signed;
    } catch (err) {
      await client.query("ROLLBACK");
      // Backstop: a concurrent writer slipped past the FOR UPDATE row lock.
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
        throw new DuplicateIdempotencyError(signed.idempotencyKey);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async listReceipts(runId: string): Promise<Receipt[]> {
    const run = await this.getRun(runId);
    if (!run) throw new RunNotFoundError(runId);
    const result = await this.pool.query<ReceiptRow>(
      "SELECT payload FROM receipts WHERE run_id = $1 ORDER BY seq ASC",
      [runId],
    );
    return result.rows.map((r) => r.payload);
  }

  async verifyChain(runId: string): Promise<ChainVerification> {
    const run = await this.getRun(runId);
    if (!run) throw new RunNotFoundError(runId);
    const receipts = await this.listReceipts(runId);
    return verifyReceipts(run, receipts);
  }

  async updateRunStatus(runId: string, status: RunStatus, spentUsd: number): Promise<void> {
    const result = await this.pool.query(
      `UPDATE runs
       SET status = $2,
           spent_usd = $3,
           ended_at = CASE WHEN $2 <> 'RUNNING' AND ended_at IS NULL THEN now() ELSE ended_at END
       WHERE id = $1`,
      [runId, status, spentUsd],
    );
    if (result.rowCount === 0) throw new RunNotFoundError(runId);
  }
}
