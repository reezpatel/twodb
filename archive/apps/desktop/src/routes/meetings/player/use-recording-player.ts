import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { trackMediaUrl, type Recording } from "../meetings-api";

const RATES = [1, 1.25, 1.5, 2, 0.75];
const TRACK_LABELS: Record<string, string> = { meeting: "Meeting", screen: "Screen share" };

export type RecordingPlayer = ReturnType<typeof useRecordingPlayer>;

/** Playback state for one recording: track choice, transport, time, and keyboard shortcuts. */
export function useRecordingPlayer(recording: Recording | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // MediaRecorder webm has no duration header; seeking far forces the browser to compute it.
  const probingDuration = useRef(false);

  const tracks = (recording?.tracks ?? [])
    .filter((t) => t.mediaAssetId && t.bytes > 0)
    .map((t) => ({ id: t.trackId, label: TRACK_LABELS[t.trackId] ?? t.trackId, durationMs: t.durationMs }));
  const [trackId, setTrackId] = useState<string | null>(null);
  const track = tracks.find((t) => t.id === trackId) ?? tracks.find((t) => t.id === "meeting") ?? tracks[0] ?? null;

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [mediaDurationMs, setMediaDurationMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const resumeAt = useRef<number | null>(null);

  const src = recording && track ? trackMediaUrl(recording.id, track.id) : null;

  useEffect(() => {
    setPlaying(false);
    setBuffering(false);
    setCurrentMs(resumeAt.current ?? 0);
    setMediaDurationMs(null);
    setError(null);
  }, [src]);

  useEffect(() => {
    setTrackId(null);
    resumeAt.current = null;
  }, [recording?.id]);

  const durationMs = mediaDurationMs ?? track?.durationMs ?? 0;

  const seek = useCallback(
    (ms: number) => {
      const v = videoRef.current;
      const clamped = Math.max(0, durationMs ? Math.min(ms, durationMs) : ms);
      if (v) v.currentTime = clamped / 1000;
      setCurrentMs(clamped);
    },
    [durationMs],
  );

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const skip = useCallback((deltaMs: number) => seek((videoRef.current?.currentTime ?? 0) * 1000 + deltaMs), [seek]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    if (videoRef.current) videoRef.current.playbackRate = next;
    setRate(next);
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  const selectTrack = (id: string) => {
    resumeAt.current = (videoRef.current?.currentTime ?? 0) * 1000;
    setTrackId(id);
  };

  const readDuration = (v: HTMLVideoElement) => {
    if (Number.isFinite(v.duration) && v.duration > 0) {
      setMediaDurationMs(v.duration * 1000);
      if (probingDuration.current) {
        probingDuration.current = false;
        v.currentTime = (resumeAt.current ?? 0) / 1000;
      }
    }
  };

  const videoProps = {
    ref: videoRef,
    src: src ?? undefined,
    preload: "metadata" as const,
    playsInline: true,
    onLoadedMetadata: (e: SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      v.playbackRate = rate;
      v.muted = muted;
      if (!Number.isFinite(v.duration)) {
        probingDuration.current = true;
        v.currentTime = 1e101;
      } else {
        readDuration(v);
        if (resumeAt.current) v.currentTime = resumeAt.current / 1000;
      }
    },
    onDurationChange: (e: SyntheticEvent<HTMLVideoElement>) => readDuration(e.currentTarget),
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (!probingDuration.current) setCurrentMs(e.currentTarget.currentTime * 1000);
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onWaiting: () => setBuffering(true),
    onPlaying: () => setBuffering(false),
    onCanPlay: () => setBuffering(false),
    onError: () => setError("This recording couldn't be loaded."),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!src || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const actions: Record<string, () => void> = {
        " ": toggle,
        k: toggle,
        j: () => skip(-10_000),
        ArrowLeft: () => skip(-5_000),
        l: () => skip(10_000),
        ArrowRight: () => skip(5_000),
        m: toggleMute,
        f: toggleFullscreen,
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, toggle, skip, toggleMute, toggleFullscreen]);

  return {
    stageRef,
    videoProps,
    src,
    tracks,
    track,
    selectTrack,
    playing,
    buffering,
    currentMs,
    durationMs,
    muted,
    rate,
    error,
    seek,
    toggle,
    skip,
    toggleMute,
    cycleRate,
    toggleFullscreen,
  };
}
