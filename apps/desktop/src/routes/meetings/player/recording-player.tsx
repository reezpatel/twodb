import type { PointerEvent } from "react";
import { Loader2, Maximize, MonitorUp, Pause, Play, RotateCcw, RotateCw, Video, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatClock, platformLabel, recordingTitle, type Recording } from "../meetings-api";
import { initials } from "../meetings-mock";
import type { RecordingPlayer as Player } from "./use-recording-player";

const CTL =
  "grid size-10 cursor-pointer place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:cursor-default disabled:opacity-50";
const PILL = "absolute inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-0.5 text-xs font-medium text-white backdrop-blur-sm";

function seekFromPointer(e: PointerEvent<HTMLDivElement>, p: Player) {
  const rect = e.currentTarget.getBoundingClientRect();
  p.seek(((e.clientX - rect.left) / rect.width) * p.durationMs);
}

/** The video stage — playback of the selected recording, styled after the live-call mock. */
export function RecordingPlayer({ recording, player: p }: { recording: Recording; player: Player }) {
  const title = recordingTitle(recording);
  const progress = p.durationMs ? Math.min(100, (p.currentMs / p.durationMs) * 100) : 0;
  const screen = p.tracks.find((t) => t.id === "screen");
  const meeting = p.tracks.find((t) => t.id === "meeting");
  const status =
    recording.status === "recording"
      ? { label: "Recording in progress", live: true }
      : recording.status === "abandoned"
        ? { label: "Abandoned", live: false }
        : { label: p.playing ? "Playing" : "Recorded", live: p.playing };

  return (
    <div ref={p.stageRef} className="group/stage relative aspect-16/8.5 overflow-hidden rounded-lg bg-neutral-950">
      {p.src && !p.error ? (
        <video {...p.videoProps} className="absolute inset-0 h-full w-full object-contain" onClick={p.toggle} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-neutral-900 to-neutral-800">
          <div className="flex flex-col items-center gap-2 text-center text-sm text-neutral-300">
            <Video size={28} className="text-neutral-500" />
            {p.error ??
              (recording.status === "recording" ? "The video is available once the extension finishes recording." : "No video was saved for this meeting.")}
          </div>
        </div>
      )}

      <span className={cn(PILL, "top-3 left-3 max-w-[60%]")}>
        <Avatar size="sm">
          <AvatarFallback className="text-[9px]">{initials(title)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{title}</span>
        <span className="hidden text-white/60 sm:inline">· {platformLabel(recording.platform)}</span>
      </span>
      <span className={cn(PILL, "top-3 right-3 gap-1.5 py-1 font-normal", status.live ? "text-white" : "text-neutral-400")}>
        <i className={cn("size-1.5 rounded-full", status.live ? "animate-ls-pulse bg-rose-300" : "bg-neutral-400")} />
        {status.label}
      </span>

      {p.buffering ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-8 animate-spin text-white/80" />
        </div>
      ) : null}

      {p.src && !p.error ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-black/60 to-transparent px-4 pt-10 pb-3">
          <div className="flex items-center gap-3 text-[11px] font-medium text-white tabular-nums">
            <span>{formatClock(p.currentMs)}</span>
            <div
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(p.durationMs / 1000)}
              aria-valuenow={Math.round(p.currentMs / 1000)}
              tabIndex={0}
              className="group/seek relative h-4 flex-1 cursor-pointer"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromPointer(e, p);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e, p);
              }}
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25">
                <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div
                className="bg-primary absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 ring-2 ring-white transition-opacity group-hover/seek:opacity-100"
                style={{ left: `${progress}%` }}
              />
            </div>
            <span className="text-white/70">{formatClock(p.durationMs)}</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button type="button" className={CTL} onClick={() => p.skip(-10_000)} aria-label="Back 10 seconds">
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className={cn(CTL, "border-primary/60 bg-primary/85 hover:bg-primary size-11")}
              onClick={p.toggle}
              aria-label={p.playing ? "Pause" : "Play"}
            >
              {p.playing ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
            </button>
            <button type="button" className={CTL} onClick={() => p.skip(10_000)} aria-label="Forward 10 seconds">
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              className={cn(CTL, p.muted && "border-rose-300/50 text-rose-300")}
              onClick={p.toggleMute}
              aria-label={p.muted ? "Unmute" : "Mute"}
              aria-pressed={p.muted}
            >
              {p.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {screen && meeting ? (
              <button
                type="button"
                className={cn(CTL, p.track?.id === "screen" && "border-primary/60 text-primary-foreground bg-primary/70")}
                onClick={() => p.selectTrack(p.track?.id === "screen" ? "meeting" : "screen")}
                aria-label={p.track?.id === "screen" ? "Show meeting" : "Show screen share"}
                aria-pressed={p.track?.id === "screen"}
              >
                <MonitorUp size={16} />
              </button>
            ) : null}
            <button type="button" className={cn(CTL, "w-auto px-3 text-xs font-semibold tabular-nums")} onClick={p.cycleRate} aria-label="Playback speed">
              {p.rate}×
            </button>
            <button type="button" className={CTL} onClick={p.toggleFullscreen} aria-label="Full screen">
              <Maximize size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
