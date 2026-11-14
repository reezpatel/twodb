import { cn } from "../../../lib/cn.js";
import type { McpTransport } from "../../../lib/artisan-client.js";

export const TRANSPORTS: Array<{ id: McpTransport; label: string; hint: string }> = [
  { id: "auto", label: "Auto", hint: "Streamable HTTP, falling back to SSE" },
  { id: "http", label: "Streamable HTTP", hint: "Current MCP transport" },
  { id: "sse", label: "SSE", hint: "Legacy transport" },
];

export function transportLabel(t: McpTransport): string {
  return TRANSPORTS.find((x) => x.id === t)?.label ?? t;
}

export function TransportPicker({ value, onChange }: { value: McpTransport; onChange: (t: McpTransport) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRANSPORTS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.hint}
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn("h-7 rounded-full px-3 text-[12px] transition-colors", value === t.id ? "bg-primary/15 text-ink" : "bg-surface-muted text-ink-muted hover:text-ink")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
