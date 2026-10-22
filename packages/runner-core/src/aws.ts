import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";

/**
 * AWS SSO bridge for runners — no state in twodb's database; the runner shell
 * outs to the aws cli and botocore's own cache (~/.aws/sso/cache) owns tokens.
 *
 * Flow (all per runner, in-memory selected profile):
 *  - status: aws present? sso-session configured? token cached & valid?
 *    which profiles exist, which is selected
 *  - login: device-code flow against the runner's start URL — returns the
 *    userCode + verificationUri for the widget; polling finishes the login
 *    and writes the token into botocore's cache so plain `aws ... --profile X`
 *    works for terminals, execs, and the agent afterwards
 *  - select: sets AWS_PROFILE for this runner process group (in-memory)
 */

export interface AwsProfileInfo {
  name: string;
  /** SSO account id when the profile maps to an SSO role. */
  accountId?: string;
  roleName?: string;
}

export interface AwsStatus {
  installed: boolean;
  /** sso-session name + start URL from ~/.aws/config, when present. */
  ssoSession: string | null;
  startUrl: string | null;
  ssoRegion: string | null;
  /** Token cached and not expired (botocore cache). */
  authenticated: boolean;
  tokenExpiresAt: string | null;
  profiles: AwsProfileInfo[];
  /** Currently selected profile (in-memory, runner-wide). */
  selectedProfile: string | null;
  error?: string;
}

export interface AwsLoginStart {
  /** The digit code the user enters at the verification URL. */
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  /** Seconds the code stays valid. */
  expiresInSeconds: number;
}

const CACHE_DIR = () => path.join(os.homedir(), ".aws", "sso", "cache");
const CONFIG_PATH = () => path.join(os.homedir(), ".aws", "config");

/** In-memory runner state (never persisted server-side). */
let selectedProfile: string | null = null;

export function selectedAwsProfile() {
  return selectedProfile;
}

/** Env for spawned processes — applies the selected AWS profile process-wide. */
export function awsEnv(): Record<string, string> {
  return selectedProfile ? { AWS_PROFILE: selectedProfile } : {};
}

function sh(cmd: string, args: string[], timeoutMs = 8000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, env: { ...process.env, ...(selectedProfile ? { AWS_PROFILE: selectedProfile } : {}) } },
      (err, stdout, stderr) => {
        resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });
}

/** Parse ~/.aws/config INI: sso-sessions and profiles. */
export function parseAwsConfig(): {
  ssoSessions: Record<string, { startUrl?: string; ssoRegion?: string }>;
  profiles: Record<string, { ssoSession?: string; accountId?: string; roleName?: string }>;
} {
  const out = { ssoSessions: {}, profiles: {} } as ReturnType<typeof parseAwsConfig>;
  try {
    const text = fs.readFileSync(CONFIG_PATH(), "utf8");
    let section: string | null = null;
    let kind: "sso" | "profile" | null = null;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      const sec = line.match(/^\[(?:profile\s+)?([^\]\s]+)\]$|^sso-session\s+([^\]]+)\]$|^\[sso-session\s+([^\]]+)\]$/);
      if (line.startsWith("[") && line.endsWith("]")) {
        const inner = line.slice(1, -1).trim();
        if (inner.startsWith("sso-session ")) {
          section = inner.slice("sso-session ".length).trim();
          kind = "sso";
          out.ssoSessions[section] = {};
        } else if (inner.startsWith("profile ")) {
          section = inner.slice("profile ".length).trim();
          kind = "profile";
          out.profiles[section] = {};
        } else {
          section = inner;
          kind = "profile"; // [default]
          out.profiles[section] = {};
        }
        continue;
      }
      if (!section || !kind) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (kind === "sso") {
        const target = out.ssoSessions[section];
        if (key === "sso_start_url") target.startUrl = value;
        if (key === "sso_region") target.ssoRegion = value;
      } else {
        const target = out.profiles[section];
        if (key === "sso_session") target.ssoSession = value;
        if (key === "sso_account_id") target.accountId = value;
        if (key === "sso_role_name") target.roleName = value;
      }
    }
  } catch {
    // no config file
  }
  return out;
}

/** Token cache file for a session name — botocore hashes the session name. */
function tokenCachePath(session: string) {
  return path.join(CACHE_DIR(), `${crypto.createHash("sha1").update(session).digest("hex")}.json`);
}

function readCachedToken(session: string): { accessToken?: string; expiresAt?: string; startUrl?: string; region?: string } | null {
  try {
    return JSON.parse(fs.readFileSync(tokenCachePath(session), "utf8"));
  } catch {
    return null;
  }
}

/** Registration cache — botocore keeps one file per registration (clientId). */
function readRegistration(): { clientId?: string; clientSecret?: string; expiresAt?: string } | null {
  try {
    const dir = CACHE_DIR();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (j.clientId && j.clientSecret && !j.startUrl) return j;
    }
  } catch {
    // no cache
  }
  return null;
}

function writeRegistration(reg: { clientId: string; clientSecret: string; expiresAt: string; scopes: string[]; grantTypes: string[] }) {
  try {
    fs.mkdirSync(CACHE_DIR(), { recursive: true });
    // One well-known file for our registrations — reuse the sha1 of "twodb-aws".
    const p = path.join(CACHE_DIR(), `${crypto.createHash("sha1").update("twodb-aws-bridge").digest("hex")}.json`);
    fs.writeFileSync(p, JSON.stringify(reg, null, 2));
  } catch {
    // best-effort — login still works via env creds for the cli calls we make
  }
}
export async function awsStatus(): Promise<AwsStatus> {
  const base: AwsStatus = {
    installed: false,
    ssoSession: null,
    startUrl: null,
    ssoRegion: null,
    authenticated: false,
    tokenExpiresAt: null,
    profiles: [],
    selectedProfile: selectedProfile,
  };

  const v = await sh("aws", ["--version"]);
  if (v.code !== 0) return { ...base, error: "aws cli not found" };
  base.installed = true;

  const cfg = parseAwsConfig();
  const sessionNames = Object.keys(cfg.ssoSessions);
  if (sessionNames.length === 0) return base;
  // One SSO per runner (settings hold one start URL) — first session wins.
  const session = sessionNames[0];
  base.ssoSession = session;
  base.startUrl = cfg.ssoSessions[session].startUrl ?? null;
  base.ssoRegion = cfg.ssoSessions[session].ssoRegion ?? null;

  const token = readCachedToken(session);
  if (token?.expiresAt) {
    base.tokenExpiresAt = token.expiresAt;
    base.authenticated = new Date(token.expiresAt).getTime() > Date.now() && Boolean(token.accessToken);
  }

  for (const [name, p] of Object.entries(cfg.profiles)) {
    if (!p.ssoSession) continue; // only SSO profiles are switchable
    base.profiles.push({ name, accountId: p.accountId, roleName: p.roleName });
  }
  // Default selection: first SSO profile when nothing selected.
  if (!selectedProfile && base.profiles.length > 0 && base.authenticated) selectedProfile = base.profiles[0].name;
  base.selectedProfile = selectedProfile;
  return base;
}

/**
 * Device-code login. Registers a client if needed, starts a device
 * authorization, returns the code+URL for the UI, and polls in the background
 * (interval from the response) until the user authorizes. On success the
 * token lands in botocore's cache under the sso-session's hash so every aws
 * command (terminals, execs, agent) authenticates without env wrangling.
 */
export async function awsLogin(opts: { startUrl?: string; ssoRegion?: string }, onCode: (start: AwsLoginStart) => void, onDone: (ok: boolean, error?: string) => void) {
  const cfg = parseAwsConfig();
  const sessionNames = Object.keys(cfg.ssoSessions);
  const session = sessionNames[0];
  if (!session) return onDone(false, "no sso-session in ~/.aws/config");
  const startUrl = opts.startUrl || cfg.ssoSessions[session].startUrl;
  const region = opts.ssoRegion || cfg.ssoSessions[session].ssoRegion || "us-east-1";
  if (!startUrl) return onDone(false, "no start URL configured");

  // 1. Register client (reuse ours while unexpired).
  let reg = readRegistration();
  if (!reg?.clientId || !reg.expiresAt || new Date(reg.expiresAt).getTime() < Date.now() + 60_000) {
    const r = await sh(
      "aws",
      ["sso-oidc", "register-client", "--client-name", "twodb-bridge", "--client-type", "public", "--grant-type", "authorization_code", "--grant-type", "refresh_token", "--scopes", "sso:account:access", "--region", region, "--output", "json", "--no-cli-pager"],
      15_000,
    );
    if (r.code !== 0) return onDone(false, `register-client failed: ${r.stderr.trim().slice(0, 300)}`);
    const j = JSON.parse(r.stdout) as { clientId: string; clientSecret: string; clientSecretExpiresAt: number };
    // clientSecretExpiresAt = epoch seconds.
    const fresh = { clientId: j.clientId, clientSecret: j.clientSecret, expiresAt: new Date(j.clientSecretExpiresAt * 1000).toISOString() };
    reg = fresh;
    writeRegistration({ ...fresh, scopes: ["sso:account:access"], grantTypes: ["authorization_code", "refresh_token"] });
  }

  // 2. Start device authorization.
  const d = await sh(
    "aws",
    ["sso-oidc", "start-device-authorization", "--client-id", reg.clientId!, "--client-secret", reg.clientSecret!, "--start-url", startUrl, "--region", region, "--output", "json", "--no-cli-pager"],
    15_000,
  );
  if (d.code !== 0) return onDone(false, `start-device-authorization failed: ${d.stderr.trim().slice(0, 300)}`);
  const dev = JSON.parse(d.stdout) as { deviceCode: string; userCode: string; verificationUri: string; verificationUriComplete?: string; expiresIn: number; interval: number };
  onCode({
    userCode: dev.userCode,
    verificationUri: dev.verificationUri,
    verificationUriComplete: dev.verificationUriComplete ?? null,
    expiresInSeconds: dev.expiresIn,
  });

  // 3. Poll for the token (device code is single-use; stop at expiry).
  const interval = Math.max(2, dev.interval ?? 5) * 1000;
  const deadline = Date.now() + dev.expiresIn * 1000;
  const poll = async () => {
    if (Date.now() > deadline) return onDone(false, "code expired — try again");
    const t = await sh(
      "aws",
      ["sso-oidc", "create-token", "--grant-type", "urn:ietf:params:oauth:grant-type:device_code", "--client-id", reg!.clientId!, "--client-secret", reg!.clientSecret!, "--device-code", dev.deviceCode, "--region", region, "--output", "json", "--no-cli-pager"],
      15_000,
    );
    if (t.code === 0) {
      try {
        const j = JSON.parse(t.stdout) as { accessToken: string; refreshToken?: string; expiresInSeconds?: number };
        // Write botocore-compatible token cache for the session.
        const payload = {
          startUrl,
          region,
          accessToken: j.accessToken,
          expiresAt: new Date(Date.now() + (j.expiresInSeconds ?? 8 * 3600) * 1000).toISOString(),
          clientId: reg!.clientId,
          clientSecret: reg!.clientSecret,
          registrationExpiresAt: reg!.expiresAt,
          ...(j.refreshToken ? { refreshToken: j.refreshToken } : {}),
        };
        fs.mkdirSync(CACHE_DIR(), { recursive: true });
        fs.writeFileSync(tokenCachePath(session), JSON.stringify(payload, null, 2));
        // Default-select the first SSO profile on fresh login.
        const cfg2 = parseAwsConfig();
        const first = Object.entries(cfg2.profiles).find(([, p]) => p.ssoSession === session);
        if (first && !selectedProfile) selectedProfile = first[0];
        onDone(true);
      } catch (e) {
        onDone(false, `token cache write failed: ${(e as Error).message}`);
      }
      return;
    }
    const pending = /authorization_pending|slow_down/i.test(t.stderr);
    if (pending) {
      setTimeout(poll, interval);
      return;
    }
    onDone(false, `create-token failed: ${t.stderr.trim().slice(0, 300)}`);
  };
  setTimeout(poll, interval);
}

/** Switch the runner's active profile (in-memory; affects execs/terminals). */
export async function awsSelectProfile(profile: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = parseAwsConfig();
  if (!cfg.profiles[profile]?.ssoSession) return { ok: false, error: "unknown sso profile" };
  const token = readCachedToken(cfg.profiles[profile].ssoSession!);
  if (!token?.accessToken || new Date(token.expiresAt ?? 0).getTime() < Date.now()) return { ok: false, error: "not authenticated — login first" };
  selectedProfile = profile;
  return { ok: true };
}
