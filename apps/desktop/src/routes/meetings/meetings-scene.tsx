import { Bell, ChevronDown, ClipboardList, Mic, MicOff, MonitorUp, MoreHorizontal, PhoneOff, Search, Sparkles, Video, VideoOff, Waves } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PARTICIPANTS, STAGE_IMG } from "./use-meetings-scene";
import { useMeetingsScene } from "./use-meetings-scene";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const CTL =
  "grid size-10 cursor-pointer place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65";

export function MeetingsScene() {
  const m = useMeetingsScene();

  return (
    <div className="bg-background h-full overflow-y-auto p-4">
      <div className="bg-card mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="m-0 truncate text-base font-semibold">Ward 4 — Morning Rounds</h2>
            <span className="text-muted-foreground truncate text-xs">City Clinic weekly review</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Search">
              <Search size={15} />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Notifications">
              <Bell size={15} />
            </Button>
            <span className="text-muted-foreground ml-1 hidden items-center gap-2 text-xs sm:inline-flex">
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">AV</AvatarFallback>
              </Avatar>
              Dr. Asha Verma
            </span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative aspect-16/8.5 overflow-hidden rounded-lg bg-neutral-950">
              <img src={STAGE_IMG} alt="Synthetic video placeholder — cobalt stage" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                <Avatar size="sm">
                  <AvatarFallback className="text-[9px]">AV</AvatarFallback>
                </Avatar>
                Dr. Asha Verma
              </span>
              <span
                className={cn(
                  "absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs backdrop-blur-sm",
                  m.listening ? "text-white" : "text-neutral-400",
                )}
              >
                <i className={cn("size-1.5 rounded-full", m.listening ? "animate-ls-pulse bg-rose-300" : "bg-neutral-400")} />
                {m.listening ? "Transcribing" : m.done ? "Transcript ready" : "Paused"}
              </span>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                <button
                  type="button"
                  className={cn(CTL, !m.micOn && "border-rose-300/50 text-rose-300")}
                  onClick={() => m.setMicOn((v) => !v)}
                  aria-label={m.micOn ? "Mute microphone" : "Unmute microphone"}
                  aria-pressed={!m.micOn}
                >
                  {m.micOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button
                  type="button"
                  className={cn(CTL, !m.camOn && "border-rose-300/50 text-rose-300")}
                  onClick={() => m.setCamOn((v) => !v)}
                  aria-label={m.camOn ? "Turn camera off" : "Turn camera on"}
                  aria-pressed={!m.camOn}
                >
                  {m.camOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
                <button type="button" className={cn(CTL, "border-rose-400/60 bg-rose-500/80 hover:bg-rose-500")} aria-label="Leave call">
                  <PhoneOff size={16} />
                </button>
                <button type="button" className={CTL} aria-label="Share screen">
                  <MonitorUp size={16} />
                </button>
                <button type="button" className={CTL} aria-label="More options">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>

            <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <span className="text-primary flex items-center gap-2.5">
                  <Waves size={16} />
                  <span className="flex flex-col leading-tight">
                    <strong className="text-foreground text-sm font-semibold">AI Scribe</strong>
                    <em className="text-muted-foreground text-xs not-italic">{m.listening ? "Listening…" : m.done ? "Finished" : "Paused"}</em>
                  </span>
                </span>
                <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
                  {Array.from({ length: 28 }, (_, i) => (
                    <i
                      key={i}
                      className={cn("w-[2.5px] rounded-sm bg-border", m.listening ? "animate-ls-wave bg-primary" : "h-1")}
                      style={{ animationDelay: `${(i % 9) * 0.12}s` }}
                    />
                  ))}
                </span>
                <Button
                  size="xs"
                  variant={m.listening ? "secondary" : "default"}
                  onClick={() => (m.done && !m.listening ? m.replay() : m.setListening((v) => !v))}
                >
                  {m.listening ? "Pause" : m.done ? "Replay" : "Resume"}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-3 border-b px-4 py-2">
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                  English <ChevronDown size={12} />
                </span>
                <span className="text-primary">
                  <Sparkles size={13} />
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                  हिन्दी <ChevronDown size={12} />
                </span>
              </div>
              <div ref={m.scrollRef} className="flex max-h-65 min-h-0 flex-1 flex-col overflow-y-auto">
                {m.lines.map((l, i) => (
                  <div key={i} className="flex gap-2.5 border-b px-4 py-3 last:border-b-0">
                    <Avatar size="sm" className="mt-0.5">
                      <AvatarFallback className="text-[9px]">{initials(l.speaker)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="text-muted-foreground text-xs">
                        <strong className="text-foreground font-semibold">{l.speaker}</strong> · {l.time}
                      </span>
                      <p className="text-muted-foreground m-0 mt-0.5 text-sm leading-relaxed">{l.text}</p>
                    </div>
                  </div>
                ))}
                {m.listening && !m.done ? (
                  <div className="flex items-center gap-1.5 px-4 py-3.5">
                    <i className="animate-ls-dot bg-muted-foreground size-1.5 rounded-full" />
                    <i className="animate-ls-dot bg-muted-foreground size-1.5 rounded-full [animation-delay:150ms]" />
                    <i className="animate-ls-dot bg-muted-foreground size-1.5 rounded-full [animation-delay:300ms]" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-3">
            <div className="bg-card overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between px-3 pt-3">
                <h3 className="m-0 text-sm font-semibold">Participants</h3>
                <span className="text-muted-foreground text-xs">Show all (6)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {PARTICIPANTS.map((p) => (
                  <div key={p.name} className="relative aspect-16/10 overflow-hidden rounded-md">
                    <img src={p.img} alt={`Synthetic video placeholder — ${p.name}`} className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/60 py-0.5 pr-2.5 pl-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-transparent text-[8px] text-white ring-1 ring-white/30">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                      {p.name}
                    </span>
                    {p.micOff ? (
                      <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                        <MicOff size={11} />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <Tabs value={m.sideTab} onValueChange={m.setSideTab}>
              <TabsList className="w-full">
                <TabsTrigger value="summary" className="flex-1 text-xs">
                  Summary
                </TabsTrigger>
                <TabsTrigger value="transcript" className="flex-1 text-xs">
                  Transcript
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {m.sideTab === "summary" ? (
              <>
                <div className="bg-card overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    className="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
                    aria-expanded={m.openKey === "overview"}
                    onClick={() => m.setOpenKey(m.openKey === "overview" ? null : "overview")}
                  >
                    <ClipboardList size={14} className="text-muted-foreground" /> Overview
                    <ChevronDown size={14} className={cn("text-muted-foreground ml-auto transition-transform", m.openKey === "overview" && "rotate-180")} />
                  </button>
                  {m.openKey === "overview" ? (
                    <p className="text-muted-foreground m-0 border-t px-3 py-2.5 text-xs leading-relaxed">
                      Morning rounds for ward 4: one discharge correction, one flagged lab panel, stock order arriving Monday, and invoice reminders pending a
                      wording review.
                    </p>
                  ) : null}
                </div>
                <div className="bg-card overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    className="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
                    aria-expanded={m.openKey === "points"}
                    onClick={() => m.setOpenKey(m.openKey === "points" ? null : "points")}
                  >
                    <Sparkles size={14} className="text-muted-foreground" /> Key points
                    <ChevronDown size={14} className={cn("text-muted-foreground ml-auto transition-transform", m.openKey === "points" && "rotate-180")} />
                  </button>
                  {m.openKey === "points" ? (
                    <ol className="text-muted-foreground m-0 flex list-decimal flex-col gap-1.5 border-t px-7 py-2.5 pl-9 text-xs leading-relaxed">
                      <li>Correct Ravi Kumar's dosage before the summary goes out.</li>
                      <li>Review Meera Iyer's flagged lipid panel before 9:40.</li>
                      <li>Stock order arrives Monday — confirm quantities at intake.</li>
                      <li>Dev reviews invoice reminder wording today.</li>
                      <li>Tuesday visiting hours to be confirmed by the front desk.</li>
                    </ol>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="bg-card flex max-h-96 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
                {m.lines.length ? (
                  m.lines.map((l, i) => (
                    <div key={i} className="text-muted-foreground text-xs leading-relaxed">
                      <span className="text-foreground/70 mr-1.5 font-mono">{l.time}</span>
                      <strong className="text-foreground font-semibold">{l.speaker}:</strong> {l.text}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground m-0 text-xs">Nothing transcribed yet.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
