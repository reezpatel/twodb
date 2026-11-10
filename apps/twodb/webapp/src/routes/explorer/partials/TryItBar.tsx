import { Send } from "lucide-react";
import { Button, Input, cn } from "@twodb/blocks";
import type { EndpointSpec } from "../../../lib/gateway-client.js";
import { MethodBadge } from "./MethodBadge.js";

/**
 * Try-it, request-builder style: method + monospace path input + Send in the
 * top bar, the assembled gateway URL shown read-only underneath (assembled
 * from the gateway prefix + the edited path — shown read-only because
 * hand-editing a URL is where encoding bugs come from). Body and response
 * live in the surrounding dialog's collapsible sections.
 * Dumb — all state flows in from the holding hook.
 */
export function TryItBar({
  endpoint,
  appSlug,
  pathInput,
  sending,
  onPathChange,
  onSend,
}: {
  endpoint: EndpointSpec;
  appSlug: string;
  pathInput: string;
  sending: boolean;
  onPathChange: (v: string) => void;
  onSend: () => void;
}) {
  const assembled = `/apps/${appSlug}${pathInput || endpoint.path}`;

  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-outline bg-paper">
      {/* Top bar: method + path + send */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline p-3">
        <MethodBadge method={endpoint.method} className="shrink-0" />
        <Input
          aria-label="Request path"
          value={pathInput}
          placeholder={endpoint.path}
          onChange={(e) => onPathChange(e.target.value)}
          className="min-w-40 flex-1 font-mono text-xs"
        />
        <Button size="sm" disabled={sending || !pathInput} onClick={onSend}>
          <Send className="size-3.5" />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
      {/* Assembled URL — read-only */}
      <p className="border-t border-outline p-3 font-mono text-xs break-all text-ink-muted">{assembled}</p>
    </div>
  );
}

/** Body textarea section content (hidden for bodyless methods). */
export function TryItBody({
  value,
  onChange,
  placeholder = "{}",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-[6px] border border-outline bg-paper p-2 font-mono text-xs outline-none",
        "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2",
      )}
    />
  );
}

/** Response section content — status + pretty body. */
export function TryItResult({ result }: { result: { status: number; body: string } }) {
  const ok = result.status >= 200 && result.status < 300;
  return (
    <div className="flex flex-col gap-2">
      <div className="font-sans text-[13px]">
        status:{" "}
        <span className={cn("font-semibold", ok ? "text-success" : "text-destructive")}>
          {result.status || "network error"}
        </span>
      </div>
      <pre className="max-h-80 overflow-auto rounded-[6px] border border-outline bg-stone p-2 font-mono text-xs whitespace-pre-wrap">
        {result.body}
      </pre>
    </div>
  );
}

/** Whether this endpoint carries a request body (GET/DELETE don't). */
export function hasRequestBody(endpoint: EndpointSpec): boolean {
  return endpoint.method !== "GET" && endpoint.method !== "DELETE";
}
