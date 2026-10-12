import { Download, ExternalLink, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, platformLabel, recordingDurationMs, recordingTitle } from "./meetings-api";
import { MeetingAside } from "./meeting-aside";
import { RecordingPlayer } from "./player/recording-player";
import { ScribePanel } from "./scribe/scribe-panel";
import { useMeetingView } from "./use-meeting-view";

export function MeetingsScene() {
  const { s, player, lines, activeIndex } = useMeetingView();
  const r = s.selected;

  if (s.recordings.isLoading) {
    return (
      <div className="text-muted-foreground grid h-full place-items-center text-sm">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!r) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <Video className="text-muted-foreground size-8" />
          <h2 className="text-base font-semibold">No meetings yet</h2>
          <p className="text-muted-foreground text-sm">
            Record a Google Meet, Zoom or Teams call with the twodb browser extension and it shows up here once the recording finishes.
          </p>
        </div>
      </div>
    );
  }

  const started = new Date(r.startedAt);
  const duration = player.durationMs || recordingDurationMs(r);

  return (
    <div className="bg-background h-full overflow-y-auto p-4">
      <div className="bg-card mx-auto flex min-h-full max-w-6xl flex-col overflow-hidden rounded-xl border">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="m-0 truncate text-base font-semibold">{recordingTitle(r)}</h2>
            <span className="text-muted-foreground truncate text-xs">
              {platformLabel(r.platform)} · {started.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })},{" "}
              {started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {duration ? ` · ${formatClock(duration)}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {r.meetingUrl ? (
              <Button variant="ghost" size="icon-sm" aria-label="Open meeting link" asChild>
                <a href={r.meetingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                </a>
              </Button>
            ) : null}
            {player.src ? (
              <Button variant="ghost" size="icon-sm" aria-label="Download video" asChild>
                <a href={player.src} download={`${recordingTitle(r)}-${player.track?.id ?? "meeting"}.webm`}>
                  <Download size={15} />
                </a>
              </Button>
            ) : null}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-3">
            <RecordingPlayer recording={r} player={player} />
            <ScribePanel
              lines={lines}
              activeIndex={activeIndex}
              playing={player.playing}
              hasMedia={!!player.src && !player.error}
              onToggle={player.toggle}
              onSeek={player.seek}
            />
          </div>
          <MeetingAside sideTab={s.sideTab} onSideTab={s.setSideTab} openKey={s.openKey} onOpenKey={s.setOpenKey} lines={lines} onSeek={player.seek} />
        </div>
      </div>
    </div>
  );
}
