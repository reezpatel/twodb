import { createContext, useContext, type ReactNode } from "react";
import { Loader2, Search, Video } from "lucide-react";
import { SideNav, SideNavGroup, SideNavHeader } from "@/components/side-nav";
import { useAppShellContext } from "@/components/blocks/app-shell/app-shell-context";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatClock, platformLabel, recordingDurationMs, recordingTitle, type Recording } from "./meetings-api";
import { useMeetingsScene } from "./use-meetings-scene";

/** Meetings scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export const MeetingsContext = createContext<ReturnType<typeof useMeetingsScene> | null>(null);

export function MeetingsProvider({ children }: { children: ReactNode }) {
  const s = useMeetingsScene();
  return <MeetingsContext.Provider value={s}>{children}</MeetingsContext.Provider>;
}

export function useMeetings() {
  const s = useContext(MeetingsContext);
  if (!s) throw new Error("useMeetings must be used within MeetingsProvider");
  return s;
}

/** The recordings list — rendered by the app shell (desktop column / mobile drawer). */
export function MeetingsSidenav() {
  const s = useMeetings();

  return (
    <SideNav>
      <SideNavHeader title="Meetings" description="Recorded by the twodb browser extension." />
      <div className="relative px-1">
        <Search size={13} className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
        <Input value={s.query} onChange={(e) => s.setQuery(e.target.value)} placeholder="Search meetings" className="h-8 pl-8 text-sm" />
      </div>
      {s.recordings.isLoading ? (
        <p className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </p>
      ) : s.total === 0 ? (
        <p className="text-muted-foreground px-2 text-xs">No recordings yet.</p>
      ) : s.groups.length === 0 ? (
        <p className="text-muted-foreground px-2 text-xs">No meetings match “{s.query}”.</p>
      ) : (
        s.groups.map((g, i) => (
          <SideNavGroup key={g.label} label={g.label} separated={i > 0}>
            {g.items.map((r) => (
              <RecordingItem key={r.id} recording={r} active={r.id === s.selectedId} onSelect={() => s.select(r.id)} />
            ))}
          </SideNavGroup>
        ))
      )}
    </SideNav>
  );
}

function RecordingItem({ recording: r, active, onSelect }: { recording: Recording; active: boolean; onSelect: () => void }) {
  const { closeNavigation } = useAppShellContext();
  const time = new Date(r.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const duration = recordingDurationMs(r);

  return (
    <button
      type="button"
      onClick={() => {
        onSelect();
        closeNavigation();
      }}
      className={cn(
        "hover:bg-accent/50 focus-visible:ring-ring flex items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Video size={15} className="mt-0.5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm", active && "font-medium")}>{recordingTitle(r)}</span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {r.status === "recording" ? (
            <>
              <i className="animate-ls-pulse size-1.5 rounded-full bg-rose-400" /> Recording
            </>
          ) : r.status === "abandoned" ? (
            "Abandoned"
          ) : (
            <>
              {time}
              {duration ? ` · ${formatClock(duration)}` : ""}
            </>
          )}
          <span className="truncate">· {platformLabel(r.platform)}</span>
        </span>
      </span>
    </button>
  );
}
