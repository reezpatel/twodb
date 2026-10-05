import { useState } from "react";
import { Archive, ChevronDown } from "lucide-react";
import { MessageMarkdown } from "@/components/message-markdown";
import { fmtTokens } from "@/components/model-picker/stats-row";
import { cn } from "@/lib/utils";

export interface CompactionBlockMeta {
  summary: string;
  firstKeptMessageId: string;
  tokensBefore: number;
  estimatedTokensAfter: number;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  costUsd: number | null;
  model: string;
  connectionId: string;
  instructions: string | null;
}

/**
 * Renders a persisted compaction: everything above this block was summarized
 * away and the summary is replayed as context from here on. Post-compaction
 * messages below it continue the session against the compacted context.
 */
export function CompactionBlock({ meta }: { meta: CompactionBlockMeta }) {
  const [expanded, setExpanded] = useState(false);
  const cost = meta.costUsd !== null && meta.costUsd > 0 ? (meta.costUsd < 0.01 ? `$${meta.costUsd.toFixed(4)}` : `$${meta.costUsd.toFixed(2)}`) : null;

  return (
    <div className="bg-card/60 rounded-lg border border-dashed">
      <button
        className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Archive size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">Compacted</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {fmtTokens(meta.tokensBefore)} → {fmtTokens(meta.estimatedTokensAfter)} tokens
        </span>
        <span className="text-muted-foreground/70 truncate font-mono text-[10px]">{meta.model}</span>
        <ChevronDown size={12} className={cn("text-muted-foreground/70 ml-auto shrink-0 transition-transform", !expanded && "-rotate-90")} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="border-t px-3 py-2">
          <MessageMarkdown text={meta.summary} />
          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]">
            <span title="Summarization call input tokens">↑ {fmtTokens(meta.usage.inputTokens)}</span>
            <span title="Summarization call output tokens (summary size)">↓ {fmtTokens(meta.usage.outputTokens)}</span>
            <span title="Cached input tokens">⚡ {fmtTokens(meta.usage.cachedTokens)}</span>
            {cost && <span title="Summarization call cost">{cost}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
