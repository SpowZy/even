-- even: append-only receipt ledger
-- Apply with: psql $DATABASE_URL -f packages/store/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS runs (
  id           uuid PRIMARY KEY,
  name         text NOT NULL,
  agent        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETE', 'CRASHED', 'STOPPED')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  max_usd      double precision NOT NULL,
  spent_usd    double precision NOT NULL DEFAULT 0,
  genesis_hash char(64) NOT NULL,
  public_key   text NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  run_id          uuid NOT NULL REFERENCES runs (id),
  seq             integer NOT NULL,
  id              uuid NOT NULL,
  prev_hash       char(64) NOT NULL,
  hash            char(64) NOT NULL,
  signature       text NOT NULL,
  idempotency_key text NOT NULL,
  payload         jsonb NOT NULL,
  PRIMARY KEY (run_id, seq),
  UNIQUE (run_id, idempotency_key)
);

-- True append-only: the database itself rejects any mutation of receipts.
CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'receipts are append-only: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipts_no_mutation ON receipts;
CREATE TRIGGER receipts_no_mutation
  BEFORE UPDATE OR DELETE ON receipts
  FOR EACH ROW EXECUTE FUNCTION reject_receipt_mutation();
