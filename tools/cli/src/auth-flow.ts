import * as http from "node:http";
import * as crypto from "node:crypto";
import { spawn } from "node:child_process";

/** Minimal first-party device/PKCE-style login used by `twodb auth`. */
export interface AuthSessionInfo {
  user: string;
  workspace: string;
  workspaceId: string;
}

const REDIRECT_PORT = 0; // ephemeral
const REDIRECT_PATH = "/cli-callback";

/**
 * Runs the login flow against the control plane:
 *  1. open the browser at /cli/auth with a PKCE challenge (the control plane
 *     page reuses the user's session, shows user + workspace, and asks to mint
 *     a CLI API key);
 *  2. receive a one-time code on a localhost callback server;
 *  3. exchange the code + verifier at POST /cli/exchange for an API key.
 */
export async function loginAndMintApiKey(gateway: string, opts: { noOpen?: boolean; name?: string } = {}): Promise<{ apiKey: string; info: AuthSessionInfo }> {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const codePromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== REDIRECT_PATH) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(200, { "content-type": "text/html" }).end(simplePage("Login failed", `<p>${escapeHtml(error)}</p>`));
        reject(new Error(error));
      } else if (code) {
        res.writeHead(200, { "content-type": "text/html" }).end(simplePage("twodb CLI", "<p>Authenticated — you can close this tab.</p>"));
        resolve({ code, state });
      } else {
        res.writeHead(400).end();
      }
      setTimeout(() => server.close(), 250);
    });
    server.on("error", reject);
    server.listen(REDIRECT_PORT, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const redirectUri = `http://127.0.0.1:${address.port}${REDIRECT_PATH}`;
      const authUrl = new URL(gateway + "/cli-auth");
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("name", opts.name ?? `twodb-cli@${process.env.USER ?? "localhost"}`);
      const url = authUrl.toString();
      process.stdout.write(`Opening browser: ${url}\n`);
      if (opts.noOpen) {
        process.stdout.write("  (--no-open: visit it manually)\n");
      } else {
        openBrowser(url).catch(() => {
          process.stdout.write("  (could not open a browser — visit the URL above manually)\n");
        });
      }
    });
    // Safety timeout.
    setTimeout(() => {
      reject(new Error("login timed out after 5 minutes"));
      try {
        server.close();
      } catch {}
    }, 5 * 60_000);
  });

  const { code } = await codePromise;
  const res = await fetch(gateway + "/cli/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, codeVerifier: verifier }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`exchange failed: ${res.status} ${text}`);
  const body = JSON.parse(text) as { apiKey: string; info: AuthSessionInfo };
  return { apiKey: body.apiKey, info: body.info };
}

function simplePage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:ui-sans-serif,system-ui;display:grid;place-items:center;height:100vh;margin:0}p{font-size:1.1rem;color:#333}</style></head><body>${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Cross-platform "open a URL in the browser" without a dependency. */
function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.on("spawn", () => resolve());
  });
}
