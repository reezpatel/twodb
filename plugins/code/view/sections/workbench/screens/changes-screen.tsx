import type { CodeSessionEvent } from "../../../shared/api";
import { GitCommitHorizontal } from "lucide-react";
import { chatSectionStyles } from "../chat-section.style";

export function ChangesScreen({ events }: { events: CodeSessionEvent[] }) {
  const changes = events.filter(
    (event): event is Extract<CodeSessionEvent, { type: "tool_result" }> =>
      event.type === "tool_result" && (event.name === "write" || event.name === "patch"),
  );

  return (
    <div className="code-chat__screen">
      <style jsx>{chatSectionStyles}</style>
      {changes.length === 0 ? (
        <div className="code-chat__empty-state">
          <GitCommitHorizontal size={28} aria-hidden="true" />
          <p>No file changes yet in this session.</p>
        </div>
      ) : (
        changes.map((change, index) => (
          <div key={index} className={`code-chat__screen-block${change.ok ? "" : " is-error"}`}>
            <span className="code-chat__screen-block-title">{change.ok ? "applied" : "failed"}</span>
            <pre className="code-chat__tool-output">{change.output}</pre>
          </div>
        ))
      )}
    </div>
  );
}
