import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { ChevronDown, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SessionPromptResolution {
  systemPrompt: string;
  skills: { name: string; source: string }[];
  instructions: { id: string; instruction: string }[];
  memories: { id: string; scope: string; content: string }[];
  mcpTools: { server: string; name: string }[];
  mcpFailures: { server: string; error: string }[];
}

/**
 * Collapsible view of the exact system prompt the next run sends — settings
 * override/default, cwd, [Skills] titles, and inline instructions. Fetched
 * lazily on first expand. Pass `endpoint` for non-code chats (assistant).
 */
export function SystemPromptBlock({ endpoint }: { endpoint?: string }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const url = endpoint ?? (sessionId ? `/api/code/sessions/${sessionId}/system-prompt` : null);
  const [expanded, setExpanded] = useState(false);
  const [fetched, setFetched] = useState(false);

  const resolution = useQuery({
    queryKey: ["system-prompt", url],
    queryFn: () => api<SessionPromptResolution>(url!),
    enabled: !!url && fetched,
  });

  const toggle = () => {
    setExpanded((v) => !v);
    if (!fetched) setFetched(true);
  };

  const skills = resolution.data?.skills ?? [];
  const instructions = resolution.data?.instructions ?? [];
  const memories = resolution.data?.memories ?? [];
  const mcpServers = [...new Set((resolution.data?.mcpTools ?? []).map((t) => t.server))];
  const mcpFailures = resolution.data?.mcpFailures ?? [];
  const counts = [
    skills.length > 0 ? `${skills.length} skill${skills.length === 1 ? "" : "s"}` : null,
    instructions.length > 0 ? `${instructions.length} instruction${instructions.length === 1 ? "" : "s"}` : null,
    memories.length > 0 ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}` : null,
    mcpServers.length > 0 ? `${mcpServers.length} MCP server${mcpServers.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-card/60 rounded-lg border border-dashed">
      <button className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left" onClick={toggle} aria-expanded={expanded}>
        <FileText size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">System prompt</span>
        {counts.length > 0 && <span className="text-muted-foreground font-mono text-[11px]">{counts.join(" · ")}</span>}
        {resolution.isPending && fetched && <span className="text-muted-foreground/70 text-[10px]">loading…</span>}
        <ChevronDown size={12} className={cn("text-muted-foreground/70 ml-auto shrink-0 transition-transform", !expanded && "-rotate-90")} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="border-t">
          {mcpFailures.length > 0 && (
            <p className="text-destructive px-3 py-2 font-mono text-[11px] leading-relaxed">
              MCP unreachable: {mcpFailures.map((f) => `${f.server} (${f.error.slice(0, 80)})`).join("; ")}
            </p>
          )}
          <pre className="text-muted-foreground max-h-96 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {resolution.data?.systemPrompt ?? "…"}
          </pre>
        </div>
      )}
    </div>
  );
}
