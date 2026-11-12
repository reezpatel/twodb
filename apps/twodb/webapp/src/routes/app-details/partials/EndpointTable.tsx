import { ArrowDown, ArrowUpDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@twodb/blocks";
import type { EndpointSpec } from "../../../lib/gateway-client.js";
import { MethodBadge } from "./MethodBadge.js";
import { AuthBadge } from "./AuthBadge.js";

export interface EndpointTableProps {
  endpoints: EndpointSpec[];
  selectedName: string | null;
  sortKey: "method" | "path" | "auth";
  sortDir: "asc" | "desc";
  onToggleSort: (key: "method" | "path" | "auth") => void;
  onSelect: (endpoint: EndpointSpec) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />;
  return dir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />;
}

/** Sortable head cell — dumb, all state comes in as props. */
function SortableHead({
  label,
  columnKey,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  label: string;
  columnKey: "method" | "path" | "auth";
  sortKey: "method" | "path" | "auth";
  sortDir: "asc" | "desc";
  onToggleSort: (key: "method" | "path" | "auth") => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none transition-colors hover:text-ink"
      onClick={() => onToggleSort(columnKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === columnKey} dir={sortDir} />
      </span>
    </TableHead>
  );
}

/** Dumb/presentational only — the endpoint list as a sortable table. */
export function EndpointTable({ endpoints, selectedName, sortKey, sortDir, onToggleSort, onSelect }: EndpointTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Method" columnKey="method" sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort} />
          <SortableHead label="Endpoint" columnKey="path" sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort} />
          <TableHead>Auth</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {endpoints.map((ep) => (
          <TableRow
            key={`${ep.method} ${ep.path}`}
            data-state={selectedName === ep.name ? "selected" : undefined}
            className="cursor-pointer"
            onClick={() => onSelect(ep)}
          >
            <TableCell>
              <MethodBadge method={ep.method} />
            </TableCell>
            <TableCell className="font-mono text-xs">{ep.path}</TableCell>
            <TableCell>
              <AuthBadge auth={ep.auth} />
            </TableCell>
            <TableCell className="max-w-md truncate whitespace-normal text-[13px] text-ink-muted">
              {ep.description || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
