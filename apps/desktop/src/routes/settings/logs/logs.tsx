import { useEffect, useRef } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { useLogs } from "./use-logs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LEVEL_COLOR: Record<string, string> = {
  error: "text-destructive",
  warn: "text-amber-500",
  info: "text-muted-foreground",
};

export function LogsSection() {
  const { entries, total, file, error, loading, levelFilter, setLevelFilter, follow, setFollow } = useLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow mode keeps the viewport pinned to the newest line.
  useEffect(() => {
    if (follow && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, follow]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Server logs</CardTitle>
              <CardDescription>
                Live tail of the server's structured log{file ? ` — ${file}` : ""}
                {total > 0 ? ` · ${total} lines` : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {(["all", "info", "warn", "error"] as const).map((lvl) => (
                <Button key={lvl} variant={levelFilter === lvl ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs capitalize" onClick={() => setLevelFilter(lvl)}>
                  {lvl}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setFollow(!follow)} title={follow ? "Pause tailing" : "Resume tailing"}>
                {follow ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {follow ? "Following" : "Paused"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-destructive mb-2 text-sm" role="alert">
              {error}
            </p>
          )}
          <div ref={scrollRef} className="bg-muted/50 h-[520px] overflow-y-auto rounded-lg border p-3 font-mono text-xs leading-5">
            {loading && entries.length === 0 && (
              <div className="text-muted-foreground flex items-center gap-2 p-2">
                <Loader2 className="size-4 animate-spin" /> loading logs…
              </div>
            )}
            {!loading && entries.length === 0 && <p className="text-muted-foreground p-2">No log lines{levelFilter !== "all" ? ` at ${levelFilter} level` : ""}.</p>}
            {entries.map((e) => (
              <div key={e.line} className="flex gap-2 whitespace-pre-wrap break-all hover:bg-accent/40">
                <span className="text-muted-foreground/50 w-10 shrink-0 text-right">{e.line}</span>
                {e.time && <span className="text-muted-foreground/70 shrink-0">{e.time.slice(11, 23)}</span>}
                {e.level && <span className={`w-10 shrink-0 font-semibold uppercase ${LEVEL_COLOR[e.level] ?? ""}`}>{e.level}</span>}
                <span className="min-w-0">
                  {e.message}
                  {e.context && <span className="text-muted-foreground/70"> {e.context}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            <Badge variant="outline" className="mr-1.5 h-4 px-1.5 text-[10px]">admin</Badge>
            Only server admins can read logs. One JSON line per event; poll every 2.5s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
