import { motion, useReducedMotion } from "motion/react";
import { MoreVertical, Play, RotateCw, Square, Trash2, Upload } from "lucide-react";
import {
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@twodb/blocks";
import type { AppStatus, RegisteredAppSummary } from "../../../lib/gateway-client.js";

export interface AppCardProps {
  app: RegisteredAppSummary;
  status: AppStatus | null;
  busy: boolean;
  onAction: (action: "install" | "start" | "stop" | "restart" | "upgrade") => void;
  onRemove: () => void;
}

/** First letter as a mark, isometric-flavored per slug. */
function AppMark({ name }: { name: string }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-[10px] border border-outline bg-paper font-sans text-base font-bold text-ink">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Fluid hover — low bounce, long settle (same family as progress fill). */
const cardHoverSpring = {
  type: "spring" as const,
  stiffness: 95,
  damping: 19,
  mass: 0.92,
};

const CARD_SHADOW_REST = "0 1px 0 rgba(15,23,42,0.02), 0 0 0 1px rgba(0,0,0,0.03)";
const CARD_SHADOW_HOVER = "0 20px 42px -30px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.06)";

/** Dumb/presentational only — one card per app. No image: the mark, title and
 * description carry the card; the hover lift is the only flourish. The badge
 * says Managed/Unmanaged, the footer holds Install, everything else lives in
 * the ⋮ menu. */
export function AppCard(props: AppCardProps) {
  const { app, status, busy } = props;
  const running = status?.containerStatus === "running";
  const uninstalled = app.installStatus === "not_installed" || app.installStatus === "uninstalled";
  const reducedMotion = useReducedMotion() ?? false;

  const hover = reducedMotion
    ? {}
    : {
        y: -5,
        scale: 1.006,
        boxShadow: CARD_SHADOW_HOVER,
      };

  return (
    <motion.div
      data-slot="app-card"
      initial={false}
      whileHover={hover}
      transition={cardHoverSpring}
      className={
        "group relative flex h-full transform-gpu flex-col gap-2 overflow-hidden rounded-md border border-outline bg-card py-5 text-ink " +
        "transition-[border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-ink/10 " +
        // Hairline top edge — the only ornament, barely there.
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-1 before:h-px " +
        "before:bg-linear-to-r before:from-transparent before:via-ink/10 before:to-transparent before:opacity-60 " +
        "hover:before:opacity-100"
      }
      style={{ boxShadow: CARD_SHADOW_REST }}
    >
      {/* Header — mark + ⋮ menu */}
      <div className="flex items-start justify-between gap-2 px-4">
        {/* Title + description + status chips */}
        <div className="flex flex-col gap-1.5 pe-4">
          <h3 className="text-base leading-snug font-semibold tracking-[-0.01em] text-ink capitalize">{app.name}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-ink-muted">
            {app.managed ? (
              <>Container lifecycle owned by the control plane. {app.version && app.version !== "external" ? `v${app.version}` : ""}</>
            ) : (
              <span className="break-all">
                {app.httpUrl || "—"} · routed at <code>{app.basePath}</code>
              </span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {app.managed && status && status.containerStatus !== "not_found" ? (
              <Chip tone={running ? "success" : "warning"}>{status.containerStatus}</Chip>
            ) : null}
          </div>
        </div>
        {/*<AppMark name={app.name} />*/}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${app.name} actions`}
              className="px-1.5 opacity-60 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {app.managed ? (
              <>
                <DropdownMenuLabel>{app.name}</DropdownMenuLabel>
                <DropdownMenuItem disabled={busy || uninstalled} onSelect={() => props.onAction(running ? "stop" : "start")}>
                  {running ? <Square /> : <Play />}
                  {running ? "Stop" : "Start"}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={busy || uninstalled} onSelect={() => props.onAction("restart")}>
                  <RotateCw />
                  Restart
                </DropdownMenuItem>
                <DropdownMenuItem disabled={busy || uninstalled} onSelect={() => props.onAction("upgrade")}>
                  <Upload />
                  Upgrade
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy || uninstalled}
                  onSelect={() => {
                    if (confirm(`Remove ${app.slug}? The container and registry row go away; its Postgres schema stays.`)) {
                      props.onRemove();
                    }
                  }}
                >
                  <Trash2 />
                  Remove
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>{app.name}</DropdownMenuLabel>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (confirm(`Unregister external app "${app.slug}"? The app itself keeps running; only the gateway entry goes away.`)) {
                      props.onRemove();
                    }
                  }}
                >
                  <Trash2 />
                  Unregister
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer — single primary action + Managed/Unmanaged badge at the end,
          in the original (plain, borderless) CardFooter style */}
      <div className="mt-auto flex flex-wrap items-center gap-2 px-4">
        {app.managed ? (
          uninstalled ? (
            <Button size="sm" disabled={busy} onClick={() => props.onAction("install")}>
              {busy ? "Installing…" : "Install"}
            </Button>
          ) : (
            <span className="font-mono text-xs break-all text-ink-muted">{app.basePath}</span>
          )
        ) : (
          <span className="font-mono text-xs break-all text-ink-muted">{app.basePath}</span>
        )}
        <span className="ml-auto font-sans text-[11px] tracking-wide text-ink-muted uppercase">{app.managed ? "Managed" : "Unmanaged"}</span>
      </div>
    </motion.div>
  );
}
