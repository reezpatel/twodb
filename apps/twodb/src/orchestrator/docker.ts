// Thin wrapper around the `docker` CLI. Shells out rather than using the
// Docker Engine API/dockerode — one less dependency, and transparent to
// debug (every operation is a command you can re-run by hand). Every
// argument is passed as an array element (never interpolated into a shell
// string), so there's no injection surface even though slugs/tags come from
// user input upstream (they're also identifier-sanitized before they get here).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DOCKER_NETWORK = "twodb-net";

async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("docker", args, { maxBuffer: 1024 * 1024 * 32 });
  } catch (err: any) {
    throw new Error(`docker ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export async function ensureNetwork(): Promise<void> {
  try {
    await docker(["network", "inspect", DOCKER_NETWORK]);
  } catch {
    await docker(["network", "create", DOCKER_NETWORK]);
  }
}

export interface BuildImageOptions {
  /** Absolute path to the repo root — the build context (needs the whole workspace for pnpm). */
  repoRoot: string;
  dockerfile: string;
  pkgName: string;
  tag: string;
}

export async function buildImage(opts: BuildImageOptions): Promise<void> {
  await docker([
    "build",
    "-f",
    opts.dockerfile,
    "--build-arg",
    `APP_PKG=${opts.pkgName}`,
    "-t",
    opts.tag,
    opts.repoRoot,
  ]);
}

export async function pullImage(ref: string): Promise<void> {
  await docker(["pull", ref]);
}

export interface RunContainerOptions {
  name: string;
  image: string;
  env: Record<string, string>;
  hostPort: number;
  containerPort: number;
  /** Publish hostPort on the host. False when TwoDB itself is containerized and reaches apps over the shared network by container name. */
  publish: boolean;
}

export async function runContainer(opts: RunContainerOptions): Promise<void> {
  await ensureNetwork();
  // Remove any stale container with the same name first (e.g. a failed
  // previous install) — `docker run` refuses to reuse a name otherwise.
  await docker(["rm", "-f", opts.name]).catch(() => {});

  const envArgs = Object.entries(opts.env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const publishArgs = opts.publish ? ["-p", `${opts.hostPort}:${opts.containerPort}`] : [];
  // Only map host.docker.internal when the env actually references it —
  // podman's docker-compat socket rejects "host-gateway" on some versions,
  // and container-mode deployments don't need it at all.
  const needsHostGateway = Object.values(opts.env).some((v) => v.includes("host.docker.internal"));
  const hostGatewayArgs = needsHostGateway ? ["--add-host", "host.docker.internal:host-gateway"] : [];
  await docker([
    "run",
    "-d",
    "--name",
    opts.name,
    "--network",
    DOCKER_NETWORK,
    ...hostGatewayArgs,
    "--restart",
    "unless-stopped",
    ...publishArgs,
    ...envArgs,
    opts.image,
  ]);
}

export async function stopContainer(name: string): Promise<void> {
  await docker(["stop", name]);
}

export async function startContainer(name: string): Promise<void> {
  await docker(["start", name]);
}

export async function restartContainer(name: string): Promise<void> {
  await docker(["restart", name]);
}

export async function removeContainer(name: string): Promise<void> {
  await docker(["rm", "-f", name]).catch(() => {});
}

export type ContainerStatus = "running" | "stopped" | "not_found" | "failed";

export async function inspectStatus(name: string): Promise<ContainerStatus> {
  try {
    const { stdout } = await docker(["inspect", "--format", "{{.State.Status}}", name]);
    const status = stdout.trim();
    if (status === "running") return "running";
    if (status === "exited" || status === "created" || status === "paused") return "stopped";
    return "failed";
  } catch {
    return "not_found";
  }
}

export async function tailLogs(name: string, lines = 100): Promise<string> {
  const { stdout, stderr } = await docker(["logs", "--tail", String(lines), name]);
  return stdout + stderr;
}
