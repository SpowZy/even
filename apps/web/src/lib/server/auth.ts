export class WriteAuthError extends Error {
  constructor(message = "missing or invalid bearer token") {
    super(message);
    this.name = "WriteAuthError";
  }
}

/**
 * Guard for mutating endpoints. Expects
 *   Authorization: Bearer ${EVEN_API_TOKEN ?? "dev-token"}
 * Throws WriteAuthError (map to 401 in route handlers).
 */
export function requireWriteAuth(req: Request): void {
  const token = process.env.EVEN_API_TOKEN ?? "dev-token";
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    throw new WriteAuthError();
  }
}
