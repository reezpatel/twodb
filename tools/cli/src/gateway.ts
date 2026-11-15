import type { CliConfig } from "./config.js";

export interface ApiError extends Error {
  status: number;
  body: string;
}

export class Gateway {
  constructor(private config: CliConfig) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { "x-api-key": this.config.apiKey ?? "", ...extra };
    return h;
  }

  /** Raw call against the gateway. `path` is absolute (starts with /). */
  async request(
    method: string,
    path: string,
    opts: { query?: Record<string, string | undefined>; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const url = new URL(this.config.gateway + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
    const headers = this.headers(opts.headers);
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    return fetch(url, { method, headers, body });
  }

  /** Raw call that returns parsed JSON, throwing a readable error on !ok. */
  async json<T = unknown>(
    method: string,
    path: string,
    opts: { query?: Record<string, string | undefined>; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const res = await this.request(method, path, opts);
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status} ${res.statusText}\n${text}`) as ApiError;
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  /** Session-authenticated call (only for minting the API key during `twodb auth`). */
  async withApiKey(key: string) {
    return new Gateway({ ...this.config, apiKey: key });
  }
}
