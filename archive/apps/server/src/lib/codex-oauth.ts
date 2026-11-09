import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";

// OpenAI Codex OAuth: PKCE + one-shot local callback listener (pi-compatible).
// Mirrors claude-oauth.ts on a different callback port so both flows can run
// side by side. The ChatGPT account id is decoded from the access-token JWT.

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CALLBACK_PORT = 1455;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;
const SCOPES = "openid profile email offline_access";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const PENDING_TTL_MS = 5 * 60 * 1000;

interface PendingFlow {
  verifier: string;
  createdAt: number;
  result:
    | { status: "pending" }
    | { status: "done"; accessToken: string; refreshToken: string; accountId: string | null; expiresAt: number | null }
    | { status: "error"; error: string };
}

const flows = new Map<string, PendingFlow>();
type PollResult = PendingFlow["result"] | { status: "unknown" };
type CompleteResult = PollResult | { status: "invalid_input" };
let callbackServer: Promise<Server> | null = null;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function accountIdFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as Record<string, unknown>;
    const claims = payload[JWT_CLAIM_PATH];
    if (typeof claims === "object" && claims !== null) {
      const id = (claims as Record<string, unknown>).chatgpt_account_id;
      if (typeof id === "string" && id) return id;
    }
  } catch {
    // not a JWT
  }
  return null;
}

async function completeFlow(flow: PendingFlow, code: string): Promise<{ status: number; title: string; detail?: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: flow.verifier,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const body = (await res.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      id_token?: unknown;
      expires_in?: unknown;
      error?: unknown;
      error_description?: unknown;
    };
    if (!res.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
      flow.result = { status: "error", error: `token exchange failed (${res.status}): ${String(body.error ?? body.error_description ?? "invalid response")}` };
      return { status: 502, title: "Token exchange failed", detail: String(body.error_description ?? body.error ?? res.status) };
    }
    const accountId = accountIdFromJwt(body.access_token) ?? (typeof body.id_token === "string" ? accountIdFromJwt(body.id_token) : null);
    flow.result = {
      status: "done",
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accountId,
      expiresAt: typeof body.expires_in === "number" ? Date.now() + body.expires_in * 1000 : null,
    };
    return { status: 200, title: "Signed in to ChatGPT", detail: "Tokens delivered to twodb." };
  } catch (e) {
    flow.result = { status: "error", error: (e as Error).message };
    return { status: 502, title: "Token exchange failed", detail: (e as Error).message };
  }
}

async function startCallbackServer(): Promise<Server> {
  if (callbackServer) return callbackServer;
  callbackServer = new Promise<Server>((resolve, reject) => {
    const server = createServer((req, res) => {
      const respond = (status: number, title: string, detail?: string) => {
        res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
        res.end(
          `<!doctype html><html><body style="font-family:system-ui;padding:40px;background:#0a0a0c;color:#eee"><h2>${title}</h2>${detail ? `<p style="opacity:.7">${detail}</p>` : ""}<p style="opacity:.5;font-size:13px">You can close this tab and return to twodb.</p></body></html>`,
        );
      };

      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/auth/callback") {
          respond(404, "Not found");
          return;
        }
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const flow = state ? flows.get(state) : undefined;

        if (!flow) {
          respond(400, "Unknown or expired sign-in", "Start the sign-in again from twodb.");
          return;
        }
        if (error || !code || !state) {
          flow.result = { status: "error", error: error ?? "missing authorization code" };
          respond(400, "Sign-in did not complete", error ?? undefined);
          return;
        }

        void completeFlow(flow, code).then((page) => respond(page.status, page.title, page.detail));
      } catch {
        respond(400, "Bad request");
      }
    });

    server.once("error", reject);
    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  }).catch((e) => {
    callbackServer = null;
    throw e;
  });
  return callbackServer;
}

/** Starts (or joins) a sign-in flow; returns the browser URL. */
export async function startCodexOAuth(): Promise<{ url: string; state: string }> {
  const now = Date.now();
  for (const [state, flow] of flows) {
    if (now - flow.createdAt > PENDING_TTL_MS && flow.result.status === "pending") flows.delete(state);
  }

  await startCallbackServer();

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(32));
  flows.set(state, { verifier, createdAt: now, result: { status: "pending" } });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: base64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "twodb",
  });

  return { url: `${AUTHORIZE_URL}?${params.toString()}`, state };
}

export function pollCodexOAuth(state: string): PollResult {
  return flows.get(state)?.result ?? { status: "unknown" };
}

/** Manual completion for firewalled local callbacks: accepts a pasted callback URL (or "code state" pair). */
export async function completeCodexOAuth(input: string): Promise<CompleteResult> {
  let code: string | null = null;
  let state: string | null = null;
  try {
    const url = new URL(input.trim());
    code = url.searchParams.get("code");
    state = url.searchParams.get("state");
  } catch {
    const parts = input.trim().split(/\s+/);
    if (parts.length === 2) {
      code = parts[0];
      state = parts[1];
    }
  }
  if (!code || !state) return { status: "invalid_input" };
  const flow = flows.get(state);
  if (!flow) return { status: "unknown" };
  if (flow.result.status === "done") return flow.result;
  await completeFlow(flow, code);
  return flow.result;
}
