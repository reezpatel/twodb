import type { MessageInfo } from "../../../lib/artisan-client.js";

/** One chat message bubble — user/assistant/compaction/error styling. */
export function MessageBubble(props: { message: MessageInfo }) {
  const m = props.message;
  const meta = (m.meta ?? {}) as { toolCalls?: Array<{ name: string }>; error?: boolean };
  const tools = meta.toolCalls ?? [];

  if (m.role === "compaction" || m.role === "system") {
    return (
      <div className="my-2 rounded-md border border-dashed border-outline px-3 py-2 text-[12px] text-ink-muted">
        {m.content.slice(0, 300)}
      </div>
    );
  }
  const isUser = m.role === "user";
  return (
    <div className={`my-2 ${isUser ? "text-right" : ""}`}>
      <div
        className={`inline-block max-w-[92%] rounded-lg px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser ? "bg-surface-muted" : meta.error ? "border border-destructive/40 text-destructive" : "border border-outline"
        }`}
      >
        {tools.length > 0 && !m.content ? (
          <span className="font-mono text-[11px] text-ink-muted">[{tools.map((t) => t.name).join(", ")}]</span>
        ) : (
          m.content
        )}
      </div>
      {tools.length > 0 && m.content ? (
        <p className="mt-1 text-[11px] text-ink-muted">tools: {tools.map((t) => t.name).join(", ")}</p>
      ) : null}
    </div>
  );
}
