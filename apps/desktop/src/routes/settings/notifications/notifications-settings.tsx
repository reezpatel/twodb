import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { notificationKeys, useNotificationRegistry, useNotificationSettings, type NotificationPreference } from "../../notifications/notification-api";

// Settings → Notifications: per-group master toggles with expandable types.
// Channel cells are tri-state: explicit on/off, or "inherit" (no row = fall
// back down the ladder type → group → registry default).

type ChannelId = "inApp" | "toast" | "osPush" | "emailDigest";
const CHANNELS: { id: ChannelId; label: string }[] = [
  { id: "inApp", label: "In-app" },
  { id: "toast", label: "Toasts" },
  { id: "osPush", label: "Push" },
  { id: "emailDigest", label: "Digest" },
];

interface Cell {
  value: boolean | null;
  effective: boolean;
}

function resolveCells(prefs: NotificationPreference[], groupId: string, typeId: string | null, defaults: Partial<Record<ChannelId, boolean>>): Record<ChannelId, Cell> {
  const typePref = typeId ? prefs.find((p) => p.groupId === groupId && p.typeId === typeId) : undefined;
  const groupPref = prefs.find((p) => p.groupId === groupId && p.typeId === null);
  const out = {} as Record<ChannelId, Cell>;
  for (const ch of CHANNELS) {
    const t = typePref?.channels?.[ch.id];
    const g = groupPref?.channels?.[ch.id];
    const value = t !== undefined && t !== null ? t : g !== undefined && g !== null ? g : null;
    const eff = value ?? defaults[ch.id] ?? false;
    out[ch.id] = { value, effective: typeId === null && value === null ? (defaults[ch.id] ?? false) : eff };
  }
  return out;
}

function ChannelMatrix({ cells, onToggle }: { cells: Record<ChannelId, Cell>; onToggle: (ch: ChannelId, next: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {CHANNELS.map((ch) => {
        const cell = cells[ch.id];
        const explicit = cell.value !== null;
        return (
          <label key={ch.id} className="flex items-center gap-2 text-xs">
            <Switch checked={cell.effective} onCheckedChange={(v) => onToggle(ch.id, v)} className="data-[state=unchecked]:opacity-70" />
            <span className={cn(explicit ? "text-foreground" : "text-muted-foreground")}>{ch.label}</span>
            {!explicit ? <span className="text-muted-foreground/60 text-[10px]">auto</span> : null}
          </label>
        );
      })}
    </div>
  );
}

export function NotificationsSettingsSection() {
  const registry = useNotificationRegistry();
  const settings = useNotificationSettings();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const save = useMutation({
    mutationFn: (body: { groupId: string; typeId: string | null; channels: Record<string, boolean | null> }) =>
      api("/api/notifications/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.settings }),
  });

  const remove = useMutation({
    mutationFn: (params: { groupId: string; typeId: string | null }) =>
      api(`/api/notifications/settings?group=${params.groupId}${params.typeId ? `&type=${params.typeId}` : ""}`, { method: "DELETE" }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.settings }),
  });

  const toggle = useCallback(
    (groupId: string, typeId: string | null, defaults: Partial<Record<ChannelId, boolean>>) => (ch: ChannelId, next: boolean) => {
      const prefs = settings.data?.preferences ?? [];
      const cells = resolveCells(prefs, groupId, typeId, defaults);
      const channels: Record<string, boolean | null> = {};
      for (const c of CHANNELS) {
        const current = cells[c.id].value;
        channels[c.id] = c.id === ch ? next : current;
      }
      save.mutate({ groupId, typeId, channels });
    },
    [settings.data, save],
  );

  const resetRow = useCallback(
    (groupId: string, typeId: string | null) => remove.mutate({ groupId, typeId }),
    [remove],
  );

  const prefs = settings.data?.preferences ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-1 text-sm">Choose what each app may send you and where. Unset channels follow their group or the app's defaults ("auto").</p>
      </div>

      {(registry.data?.groups ?? []).map((group) => {
        const groupCells = resolveCells(prefs, group.id, null, group.types[0]?.defaultChannels ?? {});
        const isOpen = expanded.has(group.id);
        return (
          <section key={group.id} className="bg-card rounded-xl border">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-muted-foreground/70 text-[10px] tracking-wide uppercase">group</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs" onClick={() => resetRow(group.id, null)}>
                    Reset
                  </Button>
                  {group.types.length > 0 ? (
                    <Button variant="ghost" size="icon-sm" aria-label={isOpen ? "Collapse" : "Expand types"} onClick={() => setExpanded((s) => (s.has(group.id) ? new Set([...s].filter((x) => x !== group.id)) : new Set([...s, group.id])))}>
                      <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                    </Button>
                  ) : null}
                </div>
              </div>
              <ChannelMatrix cells={groupCells} onToggle={toggle(group.id, null, group.types[0]?.defaultChannels ?? {})} />
            </div>
            {isOpen ? (
              <div className="border-t">
                {group.types.map((type) => {
                  const cells = resolveCells(prefs, group.id, type.id, type.defaultChannels);
                  return (
                    <div key={type.id} className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{type.label}</span>
                        <span className="text-muted-foreground/60 font-mono text-[10px]">{type.id}</span>
                        <Button variant="ghost" size="sm" className="text-muted-foreground ml-auto h-6 text-[11px]" onClick={() => resetRow(group.id, type.id)}>
                          Reset
                        </Button>
                      </div>
                      {type.description ? <p className="text-muted-foreground text-xs">{type.description}</p> : null}
                      <ChannelMatrix cells={cells} onToggle={toggle(group.id, type.id, type.defaultChannels)} />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
