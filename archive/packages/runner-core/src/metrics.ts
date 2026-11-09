import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";

/**
 * Resource metrics sampling shared by the standalone runner and the main app's
 * embedded runner. Pure Node — no native deps — so the server can import it
 * without dragging node-pty along.
 */

export interface GpuSample {
  /** Vendor (nvidia today; amd/intel when a probe exists). */
  vendor: "nvidia" | "other";
  index: number;
  name: string;
  /** GPU-wide utilization % (0-100). */
  utilization: number;
  /** Memory used / total, bytes. */
  memoryUsed: number;
  memoryTotal: number;
  temperature: number | null;
}

export interface DiskSample {
  path: string;
  /** Bytes used / total of the filesystem holding `path`. */
  used: number;
  total: number;
  /** 0-1 fraction of inodes used, when statfs reports it (linux). */
  inodeUsedRatio: number | null;
  error?: string;
}

export interface RunnerMetrics {
  /** ISO timestamp of the sample (runner clock). */
  at: string;
  cpu: {
    /** Aggregate busy fraction across all cores, 0-1. */
    busy: number;
    /** Load average over 1 minute (may exceed core count). */
    load1: number;
    cores: number;
    /** Per-core busy fractions, 0-1, length = cores (when measurable). */
    perCore: number[];
  };
  memory: { used: number; total: number };
  gpus: GpuSample[];
  disks: DiskSample[];
}

// --- CPU ---------------------------------------------------------------------

let lastCpu: { idle: number; total: number; perCore: { idle: number; total: number }[] } | null = null;

function cpuTimes() {
  const cpus = os.cpus();
  const perCore = cpus.map((c) => {
    const t = c.times;
    const idle = t.idle;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    return { idle, total };
  });
  const idle = perCore.reduce((a, c) => a + c.idle, 0);
  const total = perCore.reduce((a, c) => a + c.total, 0);
  return { idle, total, perCore };
}

/** Delta-based CPU usage — first call returns zeros (needs a baseline). */
function sampleCpu(): { busy: number; load1: number; cores: number; perCore: number[] } {
  const now = cpuTimes();
  const cores = now.perCore.length;
  const prev = lastCpu;
  lastCpu = now;
  if (!prev) return { busy: 0, load1: os.loadavg()[0] ?? 0, cores, perCore: new Array(cores).fill(0) };

  const frac = (a: { idle: number; total: number }, b: { idle: number; total: number }) => {
    const dTotal = b.total - a.total;
    const dIdle = b.idle - a.idle;
    return dTotal > 0 ? Math.max(0, Math.min(1, 1 - dIdle / dTotal)) : 0;
  };

  const perCore = now.perCore.map((c, i) => frac(prev.perCore[i] ?? c, c));
  const busy = frac(prev, now);
  return { busy, load1: os.loadavg()[0] ?? 0, cores, perCore };
}

// --- GPU (nvidia-smi; skipped silently when absent) ---------------------------

let nvidiaChecked = false;
let hasNvidia = false;

function probeNvidia(cb: (ok: boolean) => void) {
  execFile(
    "nvidia-smi",
    ["--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"],
    { timeout: 4000 },
    (err, stdout) => {
      if (err || !stdout.trim()) return cb(false);
      cb(true);
    },
  );
}

function sampleGpus(cb: (gpus: GpuSample[]) => void) {
  if (!nvidiaChecked) {
    nvidiaChecked = true;
    return probeNvidia((ok) => {
      hasNvidia = ok;
      sampleGpus(cb);
    });
  }
  if (!hasNvidia) return cb([]);
  execFile(
    "nvidia-smi",
    ["--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"],
    { timeout: 4000 },
    (err, stdout) => {
      if (err || !stdout.trim()) return cb([]);
      const gpus: GpuSample[] = [];
      for (const line of stdout.trim().split("\n")) {
        const parts = line.split(",").map((s) => s.trim());
        if (parts.length < 6) continue;
        const index = Number(parts[0]);
        const utilization = Number(parts[2]);
        const memUsed = Number(parts[3]);
        const memTotal = Number(parts[4]);
        const temp = Number(parts[5]);
        if ([index, utilization, memUsed, memTotal].some((n) => Number.isNaN(n))) continue;
        gpus.push({
          vendor: "nvidia",
          index,
          name: parts[1] || `GPU ${index}`,
          utilization: Math.max(0, Math.min(100, utilization)),
          // nvidia-smi reports MiB.
          memoryUsed: Math.round(memUsed * 1024 * 1024),
          memoryTotal: Math.round(memTotal * 1024 * 1024),
          temperature: Number.isNaN(temp) ? null : temp,
        });
      }
      cb(gpus);
    },
  );
}

// --- Disks ---------------------------------------------------------------------

/** fs.statfs — node >= 18.15 on linux/mac; callback-style, so promisified. */
const statfsAsync: ((path: string) => Promise<{ bsize: number; blocks: number; bfree: number; bavail: number; files?: number; ffree?: number }>) | null =
  typeof (fs as unknown as { statfs?: unknown }).statfs === "function"
    ? (path: string) =>
        new Promise((resolve, reject) =>
          fs.statfs(path, (err: Error | null, st: { bsize: number; blocks: number; bfree: number; bavail: number; files?: number; ffree?: number }) =>
            err ? reject(err) : resolve(st),
          ),
        )
    : null;

async function sampleDisk(path: string): Promise<DiskSample> {
  if (!statfsAsync) return { path, used: 0, total: 0, inodeUsedRatio: null, error: "statfs unavailable" };
  try {
    const st = await statfsAsync(path);
    const total = st.bsize * st.blocks;
    const free = st.bsize * (st.bfree ?? 0);
    const inodeUsedRatio = st.files && st.ffree !== undefined && st.files > 0 ? 1 - st.ffree / st.files : null;
    return { path, used: Math.max(0, total - free), total, inodeUsedRatio };
  } catch (e) {
    return { path, used: 0, total: 0, inodeUsedRatio: null, error: (e as Error).message };
  }
}

/** One full sample. GPU and disk probing are async — hence the callback shape. */
export function collectMetrics(diskPaths: string[], cb: (m: RunnerMetrics) => void) {
  sampleGpus((gpus) => {
    void Promise.all(diskPaths.map(sampleDisk)).then((disks) => {
      const total = os.totalmem();
      const free = os.freemem();
      cb({
        at: new Date().toISOString(),
        cpu: sampleCpu(),
        memory: { used: total - free, total },
        gpus,
        disks,
      });
    });
  });
}
