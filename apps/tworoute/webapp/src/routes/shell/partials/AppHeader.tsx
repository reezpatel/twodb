import { useState, type ReactNode } from "react";
import { MoreVertical, RefreshCw } from "lucide-react";
import { AppShellHeader, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@twodb/blocks";
import type { Connection, ProviderSpec } from "../../../lib/tworoute-client.js";
import type { Space } from "../../connections/hooks/useConnections.js";
import { ConnectionDialog, type ConnectionFormValues } from "./ConnectionDialog.js";

export interface AppHeaderProps {
  /** Page title — Dashboard, a connection name, or "Manage connections". */
  title: string;
  subtitle?: string;
  connections: Connection[];
  spaces: Space[];
  providers: ProviderSpec[];
  /** The connection whose page we're on (drives the hamburger), if any. */
  activeConnection?: Connection | null;
  busy: boolean;
  oauthBusy: boolean;
  onCreate: (values: ConnectionFormValues) => void;
  onEdit: (id: string, values: ConnectionFormValues) => void;
  onRefreshModels: (id: string) => void;
  /** Extra actions on the right (e.g. Refresh-all-quotas on the dashboard). */
  actions?: ReactNode;
}

/**
 * The app-wide header (blocks AppShellHeader): title on the left, shared
 * actions on the right — Add connection everywhere, plus a per-connection
 * hamburger (Edit / Refresh models) when the current page is a connection.
 * Dumb — all logic flows in via props.
 */
export function AppHeader(props: AppHeaderProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <AppShellHeader className="flex h-14 shrink-0 items-center gap-3 border-b border-outline px-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-none text-ink">{props.title}</h1>
        {props.subtitle ? <p className="mt-1 truncate text-[12px] leading-none text-ink-muted">{props.subtitle}</p> : null}
      </div>

      {props.actions}

      {props.activeConnection ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`${props.activeConnection.name} actions`}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit connection</DropdownMenuItem>
            <DropdownMenuItem
              disabled={props.busy}
              onSelect={() => props.onRefreshModels(props.activeConnection!.id)}
            >
              <RefreshCw />
              Refresh models
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ConnectionDialog
        mode="add"
        spaces={props.spaces}
        providers={props.providers}
        busy={props.busy}
        oauthBusy={props.oauthBusy}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={props.onCreate}
        onRunOauth={() => Promise.resolve(null)}
        trigger={
          <Button size="sm">Add connection</Button>
        }
      />

      {props.activeConnection ? (
        <ConnectionDialog
          mode="edit"
          connection={props.activeConnection}
          spaces={props.spaces}
          providers={props.providers}
          busy={props.busy}
          oauthBusy={props.oauthBusy}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={(values) => props.onEdit(props.activeConnection!.id, values)}
          onRunOauth={() => Promise.resolve(null)}
        />
      ) : null}
    </AppShellHeader>
  );
}
