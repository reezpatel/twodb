import { useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { SquarePen } from "lucide-react";
import { MessageMarkdown } from "@/components/message-markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface CodeArtifact {
  id: string;
  title: string;
  type: "markdown" | "html" | "code" | "text";
  content: string;
  updatedAt: string;
}

/** Canvas tab — documents the agent writes via update_canvas, live for every session flavor. */
export function CanvasScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const artifacts = useQuery({
    queryKey: ["code", "artifacts", sessionId],
    queryFn: () => api<CodeArtifact[]>(`/api/code/sessions/${sessionId}/artifacts`),
    enabled: !!sessionId,
  });

  const list = artifacts.data ?? [];
  const artifact = list.find((a) => a.id === selected) ?? list[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-card border-b flex items-center gap-2 border-b px-3 py-2">
        <SquarePen size={14} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">Canvas</span>
        {list.length > 1 && (
          <select
            className="border-input bg-background focus:border-ring focus:ring-ring/50 ml-auto h-7 max-w-56 rounded-md border px-2 text-xs shadow-xs focus:outline-none"
            value={artifact?.id ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {artifact ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="text-sm font-medium">{artifact.title}</span>
            <Badge variant="secondary" className="text-[10px]">
              {artifact.type}
            </Badge>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", artifact.type === "code" || artifact.type === "html" ? "font-mono text-xs" : "")}>
            {artifact.type === "markdown" ? (
              <MessageMarkdown variant="plain" text={artifact.content} />
            ) : artifact.type === "text" ? (
              <pre className="text-sm leading-relaxed whitespace-pre-wrap">{artifact.content}</pre>
            ) : (
              <pre className="text-muted-foreground whitespace-pre-wrap">{artifact.content}</pre>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <SquarePen size={24} className="text-muted-foreground/40" aria-hidden="true" />
          <p className="text-muted-foreground text-sm font-medium">Canvas</p>
          <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
            Documents the agent writes with the update_canvas tool appear here and update live while it works.
          </p>
        </div>
      )}
    </div>
  );
}
