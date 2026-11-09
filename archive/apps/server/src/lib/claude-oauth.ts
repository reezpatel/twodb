import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";

// Claude Code OAuth: PKCE + one-shot local callback listener (pi-compatible).
// The shared listener dispatches by state, so multiple subscriptions can sign
// in concurrently — each connection stores its own token pair.

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CALLBACK_PORT = 53692;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const SCOPES = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
const PENDING_TTL_MS = 5 * 60 * 1000;

interface PendingFlow {
  verifier: string;
  createdAt: number;
  result: { status: "pending" } | { status: "done"; accessToken: string; refreshToken: string; expiresAt: number | null } | { status: "error"; error: string };
}

const flows = new Map<string, PendingFlow>();
let callbackServer: Promise<Server> | null = null;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function completeFlow(flow: PendingFlow, code: string, state: string): Promise<{ status: number; title: string; detail?: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        state,
        redirect_uri: REDIRECT_URI,
        code_verifier: flow.verifier,
      }),
    });
    const body = (await res.json()) as { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; error?: unknown; error_description?: unknown };
    if (!res.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
      flow.result = { status: "error", error: `token exchange failed (${res.status}): ${String(body.error ?? body.error_description ?? "invalid response")}` };
      return { status: 502, title: "Token exchange failed", detail: String(body.error_description ?? body.error ?? res.status) };
    }
    flow.result = {
      status: "done",
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: typeof body.expires_at === "number" ? body.expires_at : null,
    };
    return { status: 200, title: "Signed in to Claude", detail: "Tokens delivered to twodb." };
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
        if (url.pathname !== "/callback") {
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

        void completeFlow(flow, code, state).then((page) => respond(page.status, page.title, page.detail));
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
export async function startClaudeOAuth(): Promise<{ url: string; state: string }> {
  // prune stale flows
  const now = Date.now();
  for (const [state, flow] of flows) {
    if (now - flow.createdAt > PENDING_TTL_MS && flow.result.status === "pending") flows.delete(state);
  }

  await startCallbackServer();

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(32));
  flows.set(state, { verifier, createdAt: now, result: { status: "pending" } });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: base64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
  });

  return { url: `${AUTHORIZE_URL}?${params.toString()}`, state };
}

export function pollClaudeOAuth(state: string): PendingFlow["result"] | { status: "unknown" } {
  return flows.get(state)?.result ?? { status: "unknown" };
}

/** Manual completion for firewalled local callbacks: accepts a pasted callback URL (or "code state" pair). */
export async function completeClaudeOAuth(input: string): Promise<PendingFlow["result"] | { status: "unknown" } | { status: "invalid_input" }> {
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
  await completeFlow(flow, code, state);
  return flow.result;
}
