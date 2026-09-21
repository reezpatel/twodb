import type { CodeSessionEvent } from "../../../shared/api";
import { Terminal } from "lucide-react";
import { chatSectionStyles } from "../chat-section.style";

export function TerminalScreen({ events }: { events: CodeSessionEvent[] }) {
  const commands = events.filter(
    (event): event is Extract<CodeSessionEvent, { type: "tool_result" }> => event.type === "tool_result" && event.name === "command",
  );

  return (
    <div className="code-chat__screen">
      <style jsx>{chatSectionStyles}</style>
      {commands.length === 0 ? (
        <div className="code-chat__empty-state">
          <Terminal size={28} aria-hidden="true" />
          <p>No commands run yet in this session.</p>
        </div>
      ) : (
        commands.map((command, index) => (
          <div key={index} className={`code-chat__screen-block${command.ok ? "" : " is-error"}`}>
            <pre className="code-chat__tool-output">{command.output || "(no output)"}</pre>
          </div>
        ))
      )}
    </div>
  );
}
