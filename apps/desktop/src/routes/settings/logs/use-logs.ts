import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";

export interface LogEntry {
  /** Unique render key — line numbers repeat across rotated files. */
  key: string;
  line: number;
  /** Marker row inserted when the log file was rotated/truncated. */
  divider?: boolean;
  time: string | null;
  level: string | null;
  message: string;
  context: string | null;
}

interface LogLine {
  line: number;
  raw: string;
}

export interface LogsResponse {
  lines: LogLine[];
  total: number;
  file: string;
  /** dev:ino:birthtime of the log file — changes when it's rotated/recreated. */
  fileId?: string | null;
}

function parseLine(l: LogLine, gen: number): LogEntry {
  const key = `${gen}:${l.line}`;
  try {
    const obj = JSON.parse(l.raw) as { time?: string; level?: string; msg?: string; [k: string]: unknown };
    const { time, level, msg, ...rest } = obj;
    const contextKeys = Object.keys(rest);
    const context = contextKeys.length
      ? contextKeys.map((k) => `${k}=${typeof rest[k] === "object" ? JSON.stringify(rest[k]) : String(rest[k])}`).join(" ")
      : null;
    return { key, line: l.line, time: time ?? null, level: level ?? null, message: msg ?? l.raw, context };
  } catch {
    return { key, line: l.line, time: null, level: null, message: l.raw, context: null };
  }
}

const POLL_MS = 2500;
const MAX_ENTRIES = 5000;

export function useLogs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [follow, setFollow] = useState(true);
  const lastLineRef = useRef(0);
  const fileIdRef = useRef<string | null>(null);
  const genRef = useRef(0);
  const followRef = useRef(true);
  followRef.current = follow;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchLines = (afterLine: number, limit: number) => api<LogsResponse>(`/api/logs?afterLine=${afterLine}&limit=${limit}`);

    const poll = async () => {
      try {
        // Paused: keep what's on screen, don't fetch (after the initial load).
        if (!followRef.current && lastLineRef.current > 0) return;

        const initial = lastLineRef.current === 0 && fileIdRef.current === null;
        let res = await fetchLines(lastLineRef.current, initial ? 300 : 500);
        if (cancelled) return;
        // Rotation: the file identity changed, or the same file shrank below our cursor.
        const rotated = !initial && ((res.fileId != null && fileIdRef.current != null && res.fileId !== fileIdRef.current) || res.total < lastLineRef.current);
        if (rotated) {
          lastLineRef.current = 0;
          genRef.current += 1;
          res = await fetchLines(0, 300);
          if (cancelled) return;
        }
        fileIdRef.current = res.fileId ?? fileIdRef.current ?? "";
        setError(null);
        setTotal(res.total);
        setFile(res.file);
        const gen = genRef.current;
        const parsed = res.lines.map((l) => parseLine(l, gen));
        if (rotated) {
          // Keep what was on screen; mark the boundary instead of wiping it.
          const divider: LogEntry = { key: `${gen}:divider`, line: 0, divider: true, time: null, level: null, message: "log file rotated", context: null };
          parsed.unshift(divider);
        }
        if (parsed.length > 0) {
          // Append only — a poll can never clear lines already shown.
          setEntries((prev) => {
            const next = initial ? parsed : [...prev, ...parsed];
            return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
          });
        }
        // Advance the cursor to the end of what we've read; if the file had no lines, use total.
        const last = res.lines.length ? res.lines[res.lines.length - 1].line : res.total;
        lastLineRef.current = Math.max(lastLineRef.current, last);
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const visible = levelFilter === "all" ? entries : entries.filter((e) => e.divider || e.level === levelFilter);

  return { entries: visible, total, file, error, loading, levelFilter, setLevelFilter, follow, setFollow };
}
