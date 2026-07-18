/**
 * Conservative PII/secret scrubbing. Deep-walks any JSON-shaped value and
 * replaces matches with "[REDACTED:<kind>]". False negatives are acceptable;
 * structure is never corrupted (only string leaves are rewritten, object keys
 * are left untouched).
 */

const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "openai-key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "iban", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { kind: "card", re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g },
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "phone", re: /\+\d{7,15}\b/g },
];

function redactString(input: string): { value: string; redacted: boolean } {
  let value = input;
  let redacted = false;
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(value)) {
      redacted = true;
      re.lastIndex = 0;
      value = value.replace(re, `[REDACTED:${kind}]`);
    }
  }
  return { value, redacted };
}

export function redact(value: unknown): { value: unknown; redacted: boolean } {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    let anyRedacted = false;
    const out = value.map((item) => {
      const r = redact(item);
      if (r.redacted) anyRedacted = true;
      return r.value;
    });
    return { value: out, redacted: anyRedacted };
  }
  if (value !== null && typeof value === "object") {
    let anyRedacted = false;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const r = redact(item);
      if (r.redacted) anyRedacted = true;
      out[key] = r.value;
    }
    return { value: out, redacted: anyRedacted };
  }
  return { value, redacted: false };
}
