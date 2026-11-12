import { Chip, cn } from "@twodb/blocks";
import type { ApiKeyMeta } from "../../../lib/gateway-client.js";
import { formatDate, formatRelative } from "../../../lib/format.js";
import { KeyBadge } from "./KeyBadge.js";
import { RevokeAction } from "./RevokeAction.js";
import { ScopeList } from "./ScopeList.js";

export interface KeysListProps {
  keys: ApiKeyMeta[];
  busy: boolean;
  confirmingId: string | null;
  onStartRevoke: (id: string) => void;
  onCancelRevoke: () => void;
  onRevoke: (id: string) => void;
}

const maskedKey = (k: ApiKeyMeta) => `twodb_${k.prefix}_••••••••`;

function RowActions({ k, ...p }: { k: ApiKeyMeta } & KeysListProps) {
  if (k.revokedAt) return <Chip tone="danger">revoked</Chip>;
  return (
    <RevokeAction
      active={p.confirmingId === k.id}
      disabled={p.busy}
      onStart={() => p.onStartRevoke(k.id)}
      onCancel={p.onCancelRevoke}
      onConfirm={() => p.onRevoke(k.id)}
    />
  );
}

/** Dumb/presentational — desktop table + mobile cards for the key list. */
export function KeysTable(props: KeysListProps) {
  const { keys } = props;
  return (
    <>
      <div className="hidden overflow-x-auto [scrollbar-width:none] sm:block [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline bg-stone/70 text-[10px] font-medium tracking-[0.09em] text-ink-muted uppercase">
              <th className="h-10 px-4 py-0 align-middle font-medium">Name</th>
              <th className="h-10 px-4 py-0 align-middle font-medium">Secret key</th>
              <th className="h-10 px-4 py-0 align-middle font-medium">Created</th>
              <th className="h-10 px-4 py-0 align-middle font-medium">Last used</th>
              <th className="h-10 w-[132px] px-4 py-0 align-middle font-medium">Scopes</th>
              <th className="h-10 w-28 px-4 py-0 align-middle">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {keys.map((k) => (
              <tr key={k.id} className={cn("group text-[12px] hover:bg-stone/50", k.revokedAt && "opacity-60")}>
                <td className="h-16 px-4 py-0 align-middle font-medium whitespace-nowrap text-ink">
                  <span className="flex items-center gap-2.5">
                    <KeyBadge />
                    {k.name}
                  </span>
                </td>
                <td className="h-16 px-4 py-0 align-middle whitespace-nowrap">
                  <code className="font-mono text-[11px] text-ink-muted">{maskedKey(k)}</code>
                </td>
                <td className="h-16 px-4 py-0 align-middle whitespace-nowrap text-ink-muted">{formatDate(k.createdAt)}</td>
                <td className="h-16 px-4 py-0 align-middle whitespace-nowrap text-ink-muted">{formatRelative(k.lastUsedAt)}</td>
                <td className="h-16 w-[132px] px-4 py-0 align-middle whitespace-nowrap">
                  <ScopeList scopes={k.scopes} />
                </td>
                <td className="h-16 px-4 py-0 text-right align-middle whitespace-nowrap">
                  <RowActions k={k} {...props} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-outline sm:hidden">
        {keys.map((k) => (
          <div key={k.id} className={cn("group p-4", k.revokedAt && "opacity-60")}>
            <div className="flex min-w-0 items-center gap-2.5">
              <KeyBadge />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{k.name}</span>
              <RowActions k={k} {...props} />
            </div>
            <code className="mt-3 block rounded-lg bg-stone px-2.5 py-2 font-mono text-[10.5px] text-ink-muted">{maskedKey(k)}</code>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="flex gap-5 text-[10px] text-ink-muted">
                <span>
                  <span className="block tracking-wider uppercase">Created</span>
                  <span className="mt-1 block">{formatDate(k.createdAt)}</span>
                </span>
                <span>
                  <span className="block tracking-wider uppercase">Last used</span>
                  <span className="mt-1 block">{formatRelative(k.lastUsedAt)}</span>
                </span>
              </div>
              <ScopeList scopes={k.scopes} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
