import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsNotifications, type NotificationCell, type NotificationGroup } from "@/components/blocks/settings/notifications/settings-notifications";
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

function resolveCells(
  prefs: NotificationPreference[],
  groupId: string,
  typeId: string | null,
  defaults: Partial<Record<ChannelId, boolean>>,
): Record<ChannelId, NotificationCell> {
  const typePref = typeId ? prefs.find((p) => p.groupId === groupId && p.typeId === typeId) : undefined;
  const groupPref = prefs.find((p) => p.groupId === groupId && p.typeId === null);
  const out = {} as Record<ChannelId, NotificationCell>;
  for (const ch of CHANNELS) {
    const t = typePref?.channels?.[ch.id];
    const g = groupPref?.channels?.[ch.id];
    const value = t !== undefined && t !== null ? t : g !== undefined && g !== null ? g : null;
    out[ch.id] = { value, effective: value ?? defaults[ch.id] ?? false };
  }
  return out;
}

export function NotificationsSettingsSection() {
  const registry = useNotificationRegistry();
  const settings = useNotificationSettings();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (body: { groupId: string; typeId: string | null; channels: Record<string, boolean | null> }) =>
      api("/api/notifications/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.settings }),
  });

  const removeAll = useMutation({
    mutationFn: () => api("/api/notifications/settings?all=1", { method: "DELETE" }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.settings }),
  });

  const prefs = settings.data?.preferences ?? [];

  /** Registry defaults for a row: a type's own, or (for the group row) the first type's. */
  const defaultsFor = (groupId: string, typeId: string | null): Partial<Record<ChannelId, boolean>> => {
    const group = registry.data?.groups.find((g) => g.id === groupId);
    return (typeId ? group?.types.find((t) => t.id === typeId)?.defaultChannels : group?.types[0]?.defaultChannels) ?? {};
  };

  // Writing one switch keeps the row's other explicit choices as they were.
  const toggle = useCallback(
    (groupId: string, typeId: string | null, channelId: string, next: boolean) => {
      const cells = resolveCells(prefs, groupId, typeId, defaultsFor(groupId, typeId));
      const channels: Record<string, boolean | null> = {};
      for (const c of CHANNELS) channels[c.id] = c.id === channelId ? next : cells[c.id].value;
      save.mutate({ groupId, typeId, channels });
    },
    [prefs, registry.data, save], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const groups: NotificationGroup[] = (registry.data?.groups ?? []).map((group) => ({
    id: group.id,
    label: group.label,
    row: { id: group.id, label: group.label, hint: group.description, cells: resolveCells(prefs, group.id, null, defaultsFor(group.id, null)) },
    types: group.types.map((type) => ({
      id: type.id,
      label: type.label,
      hint: type.description,
      cells: resolveCells(prefs, group.id, type.id, type.defaultChannels),
    })),
  }));

  return (
    <div className="max-w-3xl">
      <SettingsNotifications
        channels={CHANNELS}
        groups={groups}
        loading={registry.isPending || settings.isPending}
        onToggle={toggle}
        onResetAll={() => removeAll.mutate()}
        resettingAll={removeAll.isPending}
      />
    </div>
  );
}
