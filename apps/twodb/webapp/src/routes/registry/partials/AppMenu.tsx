import { KeyRound, MoreVertical, Play, RotateCw, Square, Trash2, Upload } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@twodb/blocks";
import { formatAppName } from "../../../lib/app-name.js";
import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";

export type LifecycleAction = "install" | "start" | "stop" | "restart" | "upgrade";

export interface AppMenuProps {
  app: RegisteredAppSummary;
  running: boolean;
  busy: boolean;
  onAction: (action: LifecycleAction) => void;
  onRotateToken: () => void;
  onRemove: () => void;
}

/** Dumb/presentational — the ⋮ menu: lifecycle for managed apps, token + unregister for the rest. */
export function AppMenu({ app, running, busy, onAction, onRotateToken, onRemove }: AppMenuProps) {
  const name = formatAppName(app.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${name} actions`} className="px-1.5 text-ink-muted data-[state=open]:bg-stone data-[state=open]:text-ink">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        {app.managed ? (
          <>
            <DropdownMenuItem disabled={busy} onSelect={() => onAction(running ? "stop" : "start")}>
              {running ? <Square /> : <Play />}
              {running ? "Stop" : "Start"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => onAction("restart")}>
              <RotateCw />
              Restart
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => onAction("upgrade")}>
              <Upload />
              Upgrade
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem disabled={busy} onSelect={onRotateToken}>
          <KeyRound />
          Rotate token
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={busy}
          onSelect={() => {
            const msg = app.managed
              ? `Remove ${app.slug}? The container and registry row go away; its Postgres schema stays.`
              : `Unregister external app "${app.slug}"? The app itself keeps running; only the gateway entry goes away.`;
            if (confirm(msg)) onRemove();
          }}
        >
          <Trash2 />
          {app.managed ? "Remove" : "Unregister"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
