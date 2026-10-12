import { ChevronDown, ClipboardList, MicOff, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatClock } from "./meetings-api";
import { initials, MOCK_KEY_POINTS, MOCK_OVERVIEW, MOCK_PARTICIPANTS } from "./meetings-mock";
import type { ScribeLine } from "./scribe/scribe-panel";

function Section({
  id,
  title,
  icon: Icon,
  openKey,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: typeof Sparkles;
  openKey: string | null;
  onToggle: (key: string | null) => void;
  children: React.ReactNode;
}) {
  const open = openKey === id;
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <button
        type="button"
        className="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
        aria-expanded={open}
        onClick={() => onToggle(open ? null : id)}
      >
        <Icon size={14} className="text-muted-foreground" /> {title}
        <ChevronDown size={14} className={cn("text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open ? children : null}
    </div>
  );
}

/** Right column: participants plus summary / transcript tabs (sample content until transcription lands). */
export function MeetingAside({
  sideTab,
  onSideTab,
  openKey,
  onOpenKey,
  lines,
  onSeek,
}: {
  sideTab: string;
  onSideTab: (tab: string) => void;
  openKey: string | null;
  onOpenKey: (key: string | null) => void;
  lines: ScribeLine[];
  onSeek: (ms: number) => void;
}) {
  return (
    <aside className="flex min-w-0 flex-col gap-3">
      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between px-3 pt-3">
          <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold">
            Participants
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
              Sample
            </Badge>
          </h3>
          <span className="text-muted-foreground text-xs">Show all ({MOCK_PARTICIPANTS.length + 2})</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {MOCK_PARTICIPANTS.map((p) => (
            <div key={p.name} className="relative aspect-16/10 overflow-hidden rounded-md">
              <img src={p.img} alt={`Placeholder tile — ${p.name}`} className="absolute inset-0 h-full w-full object-cover" />
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

      <Tabs value={sideTab} onValueChange={onSideTab}>
        <TabsList className="w-full">
          <TabsTrigger value="summary" className="flex-1 text-xs">
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex-1 text-xs">
            Transcript
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {sideTab === "summary" ? (
        <>
          <Section id="overview" title="Overview" icon={ClipboardList} openKey={openKey} onToggle={onOpenKey}>
            <p className="text-muted-foreground m-0 border-t px-3 py-2.5 text-xs leading-relaxed">{MOCK_OVERVIEW}</p>
          </Section>
          <Section id="points" title="Key points" icon={Sparkles} openKey={openKey} onToggle={onOpenKey}>
            <ol className="text-muted-foreground m-0 flex list-decimal flex-col gap-1.5 border-t px-7 py-2.5 pl-9 text-xs leading-relaxed">
              {MOCK_KEY_POINTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </Section>
        </>
      ) : (
        <div className="bg-card flex max-h-96 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
          {lines.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSeek(l.atMs)}
              className="text-muted-foreground hover:text-foreground text-left text-xs leading-relaxed"
            >
              <span className="text-foreground/70 mr-1.5 font-mono">{formatClock(l.atMs)}</span>
              <strong className="text-foreground font-semibold">{l.speaker}:</strong> {l.text}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
