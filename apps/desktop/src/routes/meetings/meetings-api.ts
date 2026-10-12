import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type RecordingStatus = "recording" | "finalized" | "abandoned";

export interface RecordingTrack {
  trackId: string;
  durationMs: number | null;
  bytes: number;
  mediaAssetId: string | null;
  uri: string | null;
}

export interface Recording {
  id: string;
  platform: string;
  title: string | null;
  meetingUrl: string | null;
  status: RecordingStatus;
  startedAt: string;
  endedAt: string | null;
  tracks: RecordingTrack[];
}

export const meetingKeys = {
  list: ["meetings", "recordings"] as const,
  detail: (id: string) => ["meetings", "recordings", id] as const,
};

export function useRecordings() {
  return useQuery({
    queryKey: meetingKeys.list,
    queryFn: () => api<{ recordings: Recording[] }>("/api/meetings/recordings").then((r) => r.recordings),
    // In-progress recordings change state when the extension finalizes them.
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "recording") ? 10_000 : false),
  });
}

export function useRecording(id: string | null) {
  return useQuery({
    queryKey: meetingKeys.detail(id ?? ""),
    queryFn: () => api<Recording>(`/api/meetings/recordings/${id}`),
    enabled: !!id,
  });
}

export function trackMediaUrl(recordingId: string, trackId: string) {
  return `/api/meetings/recordings/${recordingId}/tracks/${trackId}/media`;
}

const PLATFORM_LABELS: Record<string, string> = { meet: "Google Meet", zoom: "Zoom", teams: "Microsoft Teams" };

export function platformLabel(platform: string) {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function recordingTitle(r: Pick<Recording, "title" | "platform">) {
  return r.title ?? `${platformLabel(r.platform)} meeting`;
}

/** Wall time of the recording; the longest track when the end wasn't recorded. */
export function recordingDurationMs(r: Recording) {
  const tracks = Math.max(0, ...r.tracks.map((t) => t.durationMs ?? 0));
  if (tracks) return tracks;
  return r.endedAt ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime() : 0;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
