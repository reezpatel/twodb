import type { SpaceMeta } from "../../../lib/gateway-client.js";
import { formatDate } from "../../../lib/format.js";
import { CopyIdButton } from "./CopyIdButton.js";
import { SpaceBadge } from "./SpaceBadge.js";

export interface SpacesTableProps {
  spaces: SpaceMeta[];
  copiedId: string | null;
  onCopyId: (id: string) => void;
}

/** Dumb/presentational — desktop table + mobile cards for the space list. */
export function SpacesTable({ spaces, copiedId, onCopyId }: SpacesTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto [scrollbar-width:none] sm:block [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline bg-stone/70 text-[10px] font-medium tracking-[0.09em] text-ink-muted uppercase">
              <th className="h-10 px-4 py-0 align-middle font-medium">Name</th>
              <th className="h-10 px-4 py-0 align-middle font-medium">Space ID</th>
              <th className="h-10 px-4 py-0 align-middle font-medium">Created</th>
              <th className="h-10 w-28 px-4 py-0 align-middle">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {spaces.map((s) => (
              <tr key={s.id} className="group text-[12px] hover:bg-stone/50">
                <td className="h-16 px-4 py-0 align-middle font-medium whitespace-nowrap text-ink">
                  <span className="flex items-center gap-2.5">
                    <SpaceBadge />
                    {s.name}
                  </span>
                </td>
                <td className="h-16 px-4 py-0 align-middle whitespace-nowrap">
                  <code className="font-mono text-[11px] text-ink-muted">{s.id}</code>
                </td>
                <td className="h-16 px-4 py-0 align-middle whitespace-nowrap text-ink-muted">{formatDate(s.createdAt)}</td>
                <td className="h-16 px-4 py-0 text-right align-middle whitespace-nowrap">
                  <CopyIdButton copied={copiedId === s.id} onCopy={() => onCopyId(s.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-outline sm:hidden">
        {spaces.map((s) => (
          <div key={s.id} className="group p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <SpaceBadge />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{s.name}</span>
              <CopyIdButton copied={copiedId === s.id} onCopy={() => onCopyId(s.id)} />
            </div>
            <code className="mt-3 block rounded-lg bg-stone px-2.5 py-2 font-mono text-[10.5px] break-all text-ink-muted">{s.id}</code>
            <p className="mt-3 text-[10px] text-ink-muted">
              <span className="block tracking-wider uppercase">Created</span>
              <span className="mt-1 block">{formatDate(s.createdAt)}</span>
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
