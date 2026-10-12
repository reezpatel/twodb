import { useEffect, useRef } from "react";
import { ChevronDown, Sparkles, Waves } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock } from "../meetings-api";
import { initials } from "../meetings-mock";

export interface ScribeLine {
  speaker: string;
  atMs: number;
  text: string;
}

/** The AI Scribe transcript under the video — follows playback; clicking a line seeks. */
export function ScribePanel({
  lines,
  activeIndex,
  playing,
  hasMedia,
  onToggle,
  onSeek,
}: {
  lines: ScribeLine[];
  activeIndex: number;
  playing: boolean;
  hasMedia: boolean;
  onToggle: () => void;
  onSeek: (ms: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-line="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="text-primary flex items-center gap-2.5">
          <Waves size={16} />
          <span className="flex flex-col leading-tight">
            <strong className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
              AI Scribe
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                Sample
              </Badge>
            </strong>
            <em className="text-muted-foreground text-xs not-italic">{playing ? "Following playback…" : "Transcript ready"}</em>
          </span>
        </span>
        <span className="hidden h-4 items-center gap-[3px] sm:flex" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <i
              key={i}
              className={cn("bg-border w-[2.5px] rounded-sm", playing ? "animate-ls-wave bg-primary" : "h-1")}
              style={{ animationDelay: `${(i % 9) * 0.12}s` }}
            />
          ))}
        </span>
        <Button size="xs" variant={playing ? "secondary" : "default"} onClick={onToggle} disabled={!hasMedia}>
          {playing ? "Pause" : "Play"}
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
      <div ref={listRef} className="flex max-h-65 min-h-0 flex-1 flex-col overflow-y-auto">
        {lines.map((l, i) => (
          <button
            key={i}
            type="button"
            data-line={i}
            disabled={!hasMedia}
            onClick={() => onSeek(l.atMs)}
            className={cn(
              "flex gap-2.5 border-b px-4 py-3 text-left transition-colors last:border-b-0 enabled:hover:bg-accent/40",
              i === activeIndex && "bg-primary/5",
            )}
          >
            <Avatar size="sm" className="mt-0.5">
              <AvatarFallback className="text-[9px]">{initials(l.speaker)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="text-muted-foreground text-xs">
                <strong className="text-foreground font-semibold">{l.speaker}</strong> · {formatClock(l.atMs)}
              </span>
              <p className={cn("m-0 mt-0.5 text-sm leading-relaxed", i === activeIndex ? "text-foreground" : "text-muted-foreground")}>{l.text}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
