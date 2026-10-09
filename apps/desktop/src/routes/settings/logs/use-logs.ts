import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";

export interface LogEntry {
  line: number;
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
}

function parseLine(l: LogLine): LogEntry {
  try {
    const obj = JSON.parse(l.raw) as { time?: string; level?: string; msg?: string; [k: string]: unknown };
    const { time, level, msg, ...rest } = obj;
    const contextKeys = Object.keys(rest);
    const context = contextKeys.length
      ? contextKeys.map((k) => `${k}=${typeof rest[k] === "object" ? JSON.stringify(rest[k]) : String(rest[k])}`).join(" ")
      : null;
    return { line: l.line, time: time ?? null, level: level ?? null, message: msg ?? l.raw, context };
  } catch {
    return { line: l.line, time: null, level: null, message: l.raw, context: null };
  }
}

const POLL_MS = 2500;

export function useLogs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [follow, setFollow] = useState(true);
  const lastLineRef = useRef(0);
  const followRef = useRef(true);
  followRef.current = follow;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const afterLine = followRef.current ? lastLineRef.current : 0;
        const limit = followRef.current ? 500 : 300;
        const res = await api<LogsResponse>(`/api/logs?afterLine=${afterLine}&limit=${limit}`);
        if (cancelled) return;
        setError(null);
        setTotal(res.total);
        setFile(res.file);
        const parsed = res.lines.map(parseLine);
        if (followRef.current && lastLineRef.current > 0 && parsed.length > 0) {
          setEntries((prev) => [...prev, ...parsed]);
        } else {
          setEntries(parsed);
        }
        const last = res.lines.length ? res.lines[res.lines.length - 1].line : lastLineRef.current;
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

  const visible = levelFilter === "all" ? entries : entries.filter((e) => e.level === levelFilter);

  return { entries: visible, total, file, error, loading, levelFilter, setLevelFilter, follow, setFollow };
}
