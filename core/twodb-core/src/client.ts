import * as fs from "node:fs";
import * as path from "node:path";

export const APP_HEADER = "x-twodb-app";
export const TOKEN_HEADER = "x-twodb-token";
export const REGISTRATION_SECRET_HEADER = "x-twodb-registration-secret";
export const VERIFIED_HEADER = "x-gateway-verified";

export class TwoDbHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    what: string,
  ) {
    super(`${what} failed: ${status} ${body}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Network-level failure (gateway not listening yet) as opposed to an HTTP answer. */
function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError && /fetch failed/.test(err.message ?? "");
}

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  { attempts = 30, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isNetworkFailure(err)) throw err;
      await sleep(intervalMs);
    }
  }
  throw last;
}

/** Persists a minted token so restarts reuse it until it expires/gets rejected. */
export function createFileTokenStore(file: string) {
  return {
    read(): string | null {
      try {
        return fs.readFileSync(file, "utf8").trim() || null;
      } catch {
        return null;
      }
    },
    write(token: string) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, token + "\n", { mode: 0o600 });
    },
  };
}
