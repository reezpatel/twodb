import { Badge } from "../../../lib/badge";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table";
import type { Site } from "../../../lib/types";

/** Dumb table of a space's sites; row click opens the site. */
export function SitesTable({ sites, onOpen }: { sites: Site[]; onOpen: (id: string) => void }) {
  return (
    <TableCard>
      {!sites.length ? (
        <TableEmpty>No sites yet — create one above, then add pages or upload a zip. Agents can do the same through the API.</TableEmpty>
      ) : (
        <DataTable columns={["Name", "Status", { label: "Domains", mobile: false }]} minWidth={0}>
          {sites.map((s) => (
            <Tr key={s.id} onClick={() => onOpen(s.id)}>
              <Td className="font-medium text-ink">
                <span className="block max-w-[11rem] truncate sm:max-w-none">{s.name}</span>
              </Td>
              <Td><Badge tone={s.activeVersionNumber ? "success" : "neutral"}>{s.activeVersionNumber ? `v${s.activeVersionNumber} live` : "unpublished"}</Badge></Td>
              <Td hideOnMobile className="font-mono text-ink-muted">{s.hosts.length ? s.hosts.join(", ") : "No domain yet"}</Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </TableCard>
  );
}
