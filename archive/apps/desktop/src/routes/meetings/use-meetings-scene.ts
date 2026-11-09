import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { recordingTitle, platformLabel, useRecording, useRecordings, type Recording } from "./meetings-api";

export interface RecordingGroup {
  label: string;
  items: Recording[];
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Meetings app state — the recording list (sidenav) and the selected recording (content). */
export function useMeetingsScene() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The provider sits above the route outlet, so the id is read from the path.
  const routeId = /^\/apps\/meetings\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const recordings = useRecordings();
  const [query, setQuery] = useState("");

  const list = recordings.data ?? [];
  const selectedId = routeId ?? list.find((r) => r.status === "finalized")?.id ?? list[0]?.id ?? null;
  const detail = useRecording(selectedId);
  const selected = detail.data ?? list.find((r) => r.id === selectedId) ?? null;

  const groups = useMemo<RecordingGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((r) => `${recordingTitle(r)} ${platformLabel(r.platform)}`.toLowerCase().includes(q)) : list;
    const out: RecordingGroup[] = [];
    for (const r of filtered) {
      const label = dayLabel(r.startedAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [list, query]);

  const [sideTab, setSideTab] = useState("summary");
  const [openKey, setOpenKey] = useState<string | null>("overview");

  return {
    recordings,
    groups,
    total: list.length,
    query,
    setQuery,
    selectedId,
    selected,
    select: (id: string) => navigate(`/apps/meetings/${id}`),
    sideTab,
    setSideTab,
    openKey,
    setOpenKey,
  };
}
