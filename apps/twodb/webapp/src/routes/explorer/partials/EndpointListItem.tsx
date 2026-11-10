import type { EndpointSpec } from "../../../lib/gateway-client.js";

const METHOD_COLORS: Record<string, string> = {
  GET: "#16a34a",
  POST: "#2563eb",
  PATCH: "#d97706",
  PUT: "#d97706",
  DELETE: "#dc2626",
};

export function MethodChip({ method }: { method: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 48,
        padding: "1px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "monospace",
        textAlign: "center",
        color: "#fff",
        background: METHOD_COLORS[method] ?? "#6b7280",
      }}
    >
      {method}
    </span>
  );
}

export function EndpointListItem({
  endpoint,
  selected,
  onSelect,
}: {
  endpoint: EndpointSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        width: "100%",
        padding: "6px 8px",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        textAlign: "left",
        background: selected ? "var(--accent, #e5e7eb)" : "transparent",
      }}
    >
      <MethodChip method={endpoint.method} />
      <span style={{ fontFamily: "monospace", fontSize: 13 }}>{endpoint.path}</span>
    </button>
  );
}
