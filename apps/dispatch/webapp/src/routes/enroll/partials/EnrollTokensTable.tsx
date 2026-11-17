import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../../../lib/badge.js";
import type { EnrollToken } from "../../../lib/dispatch-client.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table.js";
import { formatDate, formatRelative } from "../../../lib/format.js";

export interface EnrollTokensTableProps {
  tokens: EnrollToken[];
  busy: boolean;
  onDelete: (t: EnrollToken) => void;
}

/** Dumb enrollment-key table. */
export function EnrollTokensTable(props: EnrollTokensTableProps) {
  return (
    <TableCard>
      {!props.tokens.length ? (
        <TableEmpty>No enrollment keys yet.</TableEmpty>
      ) : (
        <DataTable columns={["Name", "Status", { label: "Machines", mobile: false }, { label: "Last used", mobile: false }, "Expires", ""]}>
          {props.tokens.map((t) => {
            const expired = !!t.expiresAt && Date.parse(t.expiresAt) < Date.now();
            return (
              <Tr key={t.id}>
                <Td className="font-medium text-ink">
                  <span className="flex items-center gap-2.5">
                    <KeyRound className="size-3.5 text-ink-muted" />
                    {t.name}
                  </span>
                </Td>
                <Td>{expired ? <Badge tone="danger">expired</Badge> : <Badge tone="neutral">active</Badge>}</Td>
                <Td hideOnMobile className="text-ink-muted">{t.enrollCount}</Td>
                <Td hideOnMobile className="text-ink-muted">{formatRelative(t.lastUsedAt)}</Td>
                <Td className="text-ink-muted">{t.expiresAt ? formatDate(t.expiresAt) : "No expiry"}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onDelete(t)}>
                    <Trash2 className="size-3.5" />
                    Revoke
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </TableCard>
  );
}
