import { GitBranch } from "lucide-react";
import { StatsRow } from "@/components/model-picker/stats-row";
import type { GitLine, SessionStats } from "../use-chat-panel";

interface ChatFooterProps {
  stats: SessionStats;
  contextWindow: number | null;
  model: string;
  effectiveModel: string;
  thinkingLevel: string;
  onOpenConfig: () => void;
  gitStatus: GitLine | null;
}

/** Status strip under the composer: model + thinking chips, token stats, git line. */
export function ChatFooter({ stats, contextWindow, model, effectiveModel, thinkingLevel, onOpenConfig, gitStatus }: ChatFooterProps) {
  return (
    <div className="pb-4 pt-1">
      <StatsRow stats={stats} contextWindow={contextWindow}>
        <button type="button" className="hover:text-foreground font-medium transition-colors" title="Connection & model" onClick={onOpenConfig}>
          {model || effectiveModel || "no model"}&nbsp;&nbsp; &bull;&nbsp;&nbsp; {thinkingLevel === "medium" ? "med" : thinkingLevel}
        </button>
      </StatsRow>

      {gitStatus && (
        <div className="text-muted-foreground flex items-center gap-3 px-1 font-mono text-[11px]">
          <GitBranch size={11} aria-hidden="true" />
          {gitStatus.branch ?? "—"}
          <span>{gitStatus.dirtyFiles} changed</span>
          {gitStatus.ahead !== null && (
            <span>
              ↑{gitStatus.ahead} ↓{gitStatus.behind}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
