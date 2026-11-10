import { Button, Input, Textarea, Label } from "@twodb/blocks";
import type { EndpointSpec } from "../../../lib/gateway-client.js";

/** Dumb try-it form — all state flows in from the holding hook. */
export function TryItPanel({
  endpoint,
  pathInput,
  bodyInput,
  sending,
  result,
  onPathChange,
  onBodyChange,
  onSend,
}: {
  endpoint: EndpointSpec;
  pathInput: string;
  bodyInput: string;
  sending: boolean;
  result: { status: number; body: string } | null;
  onPathChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSend: () => void;
}) {
  const hasBody = endpoint.method !== "GET" && endpoint.method !== "DELETE";
  return (
    <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", marginTop: 16, paddingTop: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>Try it</h4>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Label htmlFor="try-path" style={{ fontSize: 12 }}>
          Path
        </Label>
        <Input
          id="try-path"
          value={pathInput}
          onChange={(e) => onPathChange(e.target.value)}
          style={{ fontFamily: "monospace", flex: 1 }}
          placeholder={endpoint.path}
        />
        <Button onClick={onSend} disabled={sending} size="sm">
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
      {hasBody ? (
        <Textarea
          value={bodyInput}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={6}
          style={{ fontFamily: "monospace", fontSize: 12, marginTop: 8, width: "100%" }}
          placeholder="{}"
        />
      ) : null}
      {result ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            status:{" "}
            <strong style={{ color: result.status >= 200 && result.status < 300 ? "#16a34a" : "#dc2626" }}>
              {result.status || "network error"}
            </strong>
          </div>
          <pre
            style={{
              fontSize: 12,
              background: "var(--muted, #f3f4f6)",
              padding: 8,
              borderRadius: 4,
              overflow: "auto",
              maxHeight: 400,
            }}
          >
            {result.body}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
