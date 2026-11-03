import { useState, type ComponentProps } from "react";
import { Bell, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader } from "../settings-card";

export interface NotificationChannel {
  id: string;
  label: string;
}

/** One switch. `value` is the explicit choice, or null when it follows the default; `effective` is what actually applies. */
export interface NotificationCell {
  value: boolean | null;
  effective: boolean;
}

export interface NotificationRow {
  id: string;
  label: string;
  hint?: string | null;
  cells: Record<string, NotificationCell>;
}

export interface NotificationGroup {
  id: string;
  label: string;
  /** The group-wide row: its switches are the fallback for every type below. */
  row: NotificationRow;
  types: NotificationRow[];
}

export interface SettingsNotificationsProps extends Omit<ComponentProps<"section">, "onToggle" | "onResetAll"> {
  channels: NotificationChannel[];
  groups: NotificationGroup[];
  loading?: boolean;
  /** `typeId` is null for the group-wide row. */
  onToggle: (groupId: string, typeId: string | null, channelId: string, next: boolean) => void;
  /** Clears every explicit choice across all groups. Adds a "Reset all" button to the header. */
  onResetAll?: () => void;
  /** True while a reset-all is in flight. */
  resettingAll?: boolean;
  emptyLabel?: string;
}

/** Column template: name, then one fixed column per channel. Shared by every row so the switches line up. */
const columns = (channelCount: number) => ({ gridTemplateColumns: `minmax(0,1fr) repeat(${channelCount}, 4.25rem)` });

function SwitchCells({
  channels,
  cells,
  label,
  onToggle,
}: {
  channels: NotificationChannel[];
  cells: Record<string, NotificationCell>;
  label: string;
  onToggle: (channelId: string, next: boolean) => void;
}) {
  return (
    <>
      {channels.map((channel) => (
        <div key={channel.id} className="flex justify-center">
          <Switch
            checked={cells[channel.id]?.effective ?? false}
            onCheckedChange={(next) => onToggle(channel.id, next)}
            aria-label={`${label} via ${channel.label}`}
          />
        </div>
      ))}
    </>
  );
}

/** Per-group notification preferences: a table of switches (rows × channels) per group, with the group-wide row on top and its types expandable beneath. Controlled. */
export function SettingsNotifications({
  channels,
  groups,
  loading,
  onToggle,
  onResetAll,
  resettingAll,
  emptyLabel = "No notification types are registered yet.",
  className,
  ...props
}: SettingsNotificationsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // Nothing to reset when every switch is still on its default.
  const hasAnyExplicit = groups.some((g) => [g.row, ...g.types].some((r) => Object.values(r.cells).some((c) => c.value !== null)));

  return (
    <SettingsCard data-slot="settings-notifications" className={className} {...props}>
      <SettingsCardHeader icon={Bell} title="Notifications">
        {onResetAll ? (
          <Button type="button" variant="secondary" size="sm" disabled={resettingAll || loading || !hasAnyExplicit} onClick={onResetAll}>
            {resettingAll ? <Loader2 className="animate-spin" /> : null} Reset all
          </Button>
        ) : null}
      </SettingsCardHeader>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">{emptyLabel}</p>
      ) : (
        <>
          {/* One channel header for the whole card, so every group's switches line up under it. */}
          <div className={cn("relative grid items-center gap-x-1 px-5 py-2", SETTINGS_DIVIDER)} style={columns(channels.length)}>
            <span className="text-muted-foreground/70 text-xs">Notification</span>
            {channels.map((channel) => (
              <span key={channel.id} className="text-muted-foreground/70 text-center text-xs">
                {channel.label}
              </span>
            ))}
          </div>

          {groups.map((group, groupIndex) => {
            const open = expanded.has(group.id);
            const lastGroup = groupIndex === groups.length - 1;
            return (
              <section key={group.id} data-group={group.id} className={cn("relative", !lastGroup && SETTINGS_DIVIDER)}>
                <div className="flex items-center gap-2 px-5 pt-3">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{group.label}</span>
                  <div className="ml-auto flex items-center gap-1">
                    {group.types.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-expanded={open}
                        aria-label={open ? `Hide ${group.label} types` : `Show ${group.label} types`}
                        onClick={() => toggleExpanded(group.id)}
                      >
                        <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <NotificationTableRow
                  channels={channels}
                  row={group.row}
                  title={`All ${group.label}`}
                  hint={group.row.hint}
                  onToggle={(channelId, next) => onToggle(group.id, null, channelId, next)}
                />

                {open
                  ? group.types.map((type) => (
                      <NotificationTableRow
                        key={type.id}
                        channels={channels}
                        row={type}
                        title={type.label}
                        hint={type.hint}
                        indent
                        onToggle={(channelId, next) => onToggle(group.id, type.id, channelId, next)}
                      />
                    ))
                  : null}
              </section>
            );
          })}
        </>
      )}
    </SettingsCard>
  );
}

function NotificationTableRow({
  channels,
  row,
  title,
  hint,
  divider,
  indent,
  onToggle,
}: {
  channels: NotificationChannel[];
  row: NotificationRow;
  title: string;
  hint?: string | null;
  divider?: boolean;
  indent?: boolean;
  onToggle: (channelId: string, next: boolean) => void;
}) {
  return (
    <div
      data-slot="settings-notifications-row"
      className={cn("group relative grid items-center gap-x-1 px-5 py-3", divider && SETTINGS_DIVIDER)}
      style={columns(channels.length)}
    >
      <div className={cn("min-w-0", indent && "pl-3")}>
        <div className="flex items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">{title}</span>
        </div>
        {hint ? <p className="text-muted-foreground/70 text-xs">{hint}</p> : null}
      </div>
      <SwitchCells channels={channels} cells={row.cells} label={title} onToggle={onToggle} />
    </div>
  );
}
