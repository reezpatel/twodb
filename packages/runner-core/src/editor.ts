import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as https from "node:https";

/** code-server lifecycle on the runner: probe → (auto-install) → spawn per
 *  workdir on an ephemeral localhost port. The server proxies to it over the
 *  runner connection, so it never needs auth of its own (--auth none). */

export interface EditorStatus {
  installed: boolean;
  version: string | null;
  /** Why install can't proceed (e.g. windows_unsupported). */
  reason?: string;
}

interface RunningEditor {
  child: ChildProcess;
  port: number;
  workdir: string;
  startedAt: number;
  lastTouchedAt: number;
}

const INSTALL_ROOT = path.join(os.homedir(), ".cache", "twodb", "code-server");
const IDLE_SHUTDOWN_MS = 30 * 60_000;

function platformArch(): { os: "linux" | "darwin"; arch: "amd64" | "arm64" } | null {
  const p = process.platform;
  if (p !== "linux" && p !== "darwin") return null;
  const a = process.arch === "x64" ? "amd64" : process.arch === "arm64" ? "arm64" : null;
  return a ? { os: p, arch: a } : null;
}

function exec(cmd: string, args: string[], timeoutMs = 15_000): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout) => {
      resolve({ stdout: stdout ?? "", code: err ? ((err as { code?: number }).code ?? 1) : 0 });
    });
  });
}

/** Where a working code-server binary lives — PATH first, then our cache. */
async function findCodeServer(): Promise<{ bin: string; version: string } | null> {
  const onPath = await exec("code-server", ["--version"]);
  if (onPath.code === 0) return { bin: "code-server", version: onPath.stdout.split("\n")[0]?.split(" ")[0] ?? "unknown" };
  const installed = path.join(INSTALL_ROOT, "current", "bin", "code-server");
  if (fs.existsSync(installed)) {
    const local = await exec(installed, ["--version"]);
    if (local.code === 0) return { bin: installed, version: local.stdout.split("\n")[0]?.split(" ")[0] ?? "unknown" };
  }
  return null;
}

function download(url: string, dest: string, onProgress?: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects: number) => {
      https
        .get(u, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (redirects > 5) return reject(new Error("too many redirects"));
            return follow(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} downloading code-server`));
          }
          const out = fs.createWriteStream(dest);
          let bytes = 0;
          res.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            onProgress?.(bytes);
          });
          res.pipe(out);
          out.on("finish", () => out.close(() => resolve()));
          out.on("error", reject);
        })
        .on("error", reject);
    };
    follow(url, 0);
  });
}

export class EditorManager {
  private editors = new Map<string, RunningEditor>(); // key: workdir
  private installing: Promise<{ bin: string; version: string } | null> | null = null;
  private send: (msg: unknown) => void;
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(opts: { send: (msg: unknown) => void }) {
    this.send = opts.send;
  }

  async status(): Promise<EditorStatus> {
    const found = await findCodeServer();
    if (found) return { installed: true, version: found.version };
    if (!platformArch()) return { installed: false, version: null, reason: "windows_unsupported" };
    return { installed: false, version: null };
  }

  /** Download the standalone tarball into ~/.cache/twodb/code-server — no
   *  root, no package manager. Concurrent calls share one install. */
  async install(onProgress?: (bytes: number) => void): Promise<EditorStatus> {
    const existing = await findCodeServer();
    if (existing) return { installed: true, version: existing.version };
    const pa = platformArch();
    if (!pa) return { installed: false, version: null, reason: "windows_unsupported" };

    this.installing ??= (async () => {
      const version = "4.104.2"; // pinned — bump deliberately
      const tgz = path.join(INSTALL_ROOT, `code-server-${version}-${pa.os}-${pa.arch}.tar.gz`);
      fs.mkdirSync(INSTALL_ROOT, { recursive: true });
      await download(`https://github.com/coder/code-server/releases/download/v${version}/code-server-${version}-${pa.os}-${pa.arch}.tar.gz`, tgz, onProgress);
      // Tarballs unpack to code-server-<v>-<os>-<arch>/; swap a `current` symlink.
      const extractTo = path.join(INSTALL_ROOT, `v${version}`);
      fs.rmSync(extractTo, { recursive: true, force: true });
      fs.mkdirSync(extractTo, { recursive: true });
      const untar = await exec("tar", ["-xzf", tgz, "-C", extractTo, "--strip-components=1"], 120_000);
      if (untar.code !== 0) throw new Error("failed to unpack code-server tarball");
      fs.rmSync(tgz, { force: true });
      const current = path.join(INSTALL_ROOT, "current");
      fs.rmSync(current, { recursive: true, force: true });
      fs.symlinkSync(extractTo, current, "dir");
      const bin = path.join(current, "bin", "code-server");
      fs.chmodSync(bin, 0o755);
      return { bin, version };
    })().finally(() => {
      this.installing = null;
    });

    const result = await this.installing;
    return result ? { installed: true, version: result.version } : { installed: false, version: null, reason: "install_failed" };
  }

  /** Start (or reuse) a code-server for a workdir; returns its port. */
  async ensure(workdir: string): Promise<{ port: number }> {
    const existing = this.editors.get(workdir);
    if (existing && existing.child.exitCode === null) {
      existing.lastTouchedAt = Date.now();
      return { port: existing.port };
    }

    const found = await findCodeServer();
    if (!found) throw new Error("code-server not installed");

    const child = spawn(found.bin, [
      "--bind-addr", "127.0.0.1:0",
      "--auth", "none",
      "--disable-telemetry",
      "--disable-update-check",
      "--disable-workspace-trust",
      workdir,
    ], { env: { ...process.env, XDG_DATA_HOME: path.join(os.homedir(), ".cache", "twodb") }, stdio: ["ignore", "pipe", "pipe"] });

    const port = await new Promise<number>((resolve, reject) => {
      let buf = "";
      const onData = (d: Buffer) => {
        buf += d.toString();
        // code-server logs "HTTP server listening on http://127.0.0.1:<port>/"
        const m = /listening on https?:\/\/127\.0\.0\.1:(\d+)/.exec(buf);
        if (m) {
          child.stdout?.off("data", onData);
          resolve(Number(m[1]));
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", (d: Buffer) => {
        buf += d.toString();
      });
      child.on("exit", (code) => reject(new Error(`code-server exited early (${code})`)));
      setTimeout(() => reject(new Error("code-server start timed out")), 30_000);
    });

    this.editors.set(workdir, { child, port, workdir, startedAt: Date.now(), lastTouchedAt: Date.now() });
    child.on("exit", () => this.editors.delete(workdir));
    this.startSweeper();
    this.send({ type: "editorStarted", workdir, port });
    return { port };
  }

  /** Which port serves this workdir, if running. */
  portFor(workdir: string): number | null {
    const e = this.editors.get(workdir);
    if (!e || e.child.exitCode !== null) return null;
    e.lastTouchedAt = Date.now();
    return e.port;
  }

  list(): { workdir: string; port: number }[] {
    return [...this.editors.values()].filter((e) => e.child.exitCode === null).map((e) => ({ workdir: e.workdir, port: e.port }));
  }

  private startSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      for (const [workdir, editor] of this.editors) {
        if (Date.now() - editor.lastTouchedAt > IDLE_SHUTDOWN_MS) {
          editor.child.kill();
          this.editors.delete(workdir);
          this.send({ type: "editorStopped", workdir, reason: "idle" });
        }
      }
    }, 60_000);
    this.sweeper.unref?.();
  }

  shutdown() {
    for (const editor of this.editors.values()) editor.child.kill();
    this.editors.clear();
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }
}
