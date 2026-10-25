import { db } from "../../auth";
import type { ChannelId, ChannelSet, Urgency } from "./registry";
import { URGENCY_RANK } from "./registry";

// Preference resolution: type-level → group-level → registry defaults.
// Tri-state channels (null = inherit) collapse onto the final effective set.

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string; // "07:00"
  /** Local timezone name. */
  timezone: string;
}

export interface EffectiveChannels extends ChannelSet {
  urgencyFloor: Urgency | null;
}

export interface PreferenceRow {
  groupId: string;
  typeId: string | null;
  channels: ChannelSet;
  urgencyFloor: string | null;
}

async function userPreferences(organizationId: string, userId: string): Promise<PreferenceRow[]> {
  const rows = await db
    .selectFrom("notification_preference")
    .select(["groupId", "typeId", "channels", "urgencyFloor"])
    .where("organizationId", "=", organizationId)
    .where("userId", "=", userId)
    .execute();
  return rows.map((r) => ({ groupId: r.groupId, typeId: r.typeId, channels: (r.channels ?? {}) as ChannelSet, urgencyFloor: r.urgencyFloor }));
}

/** Resolve the effective channel set + urgency floor for one type. */
export async function effectiveChannels(organizationId: string, userId: string, groupId: string, typeId: string, defaults: ChannelSet, defaultUrgency: Urgency): Promise<EffectiveChannels> {
  const prefs = await userPreferences(organizationId, userId);
  const typePref = prefs.find((p) => p.typeId === typeId);
  const groupPref = prefs.find((p) => p.groupId === groupId && p.typeId === null);

  const pick = (ch: ChannelId): boolean => {
    const t = typePref?.channels[ch];
    if (t !== undefined && t !== null) return t;
    const g = groupPref?.channels[ch];
    if (g !== undefined && g !== null) return g;
    return defaults[ch] ?? false;
  };

  const floor: string | null = typePref?.urgencyFloor ?? groupPref?.urgencyFloor ?? null;
  return {
    inApp: pick("inApp"),
    toast: pick("toast"),
    osPush: pick("osPush"),
    emailDigest: pick("emailDigest"),
    urgencyFloor: (floor as Urgency | null) ?? null,
  };
}

/** True when the notification urgency clears the user's floor. */
export function clearsFloor(urgency: Urgency, floor: Urgency | null): boolean {
  if (!floor) return true;
  return URGENCY_RANK[urgency] >= URGENCY_RANK[floor];
}

/** Quiet-hours gate: critical always breaks through; everything else waits
 *  (delivery decision is advisory for push — in-app rows are never held). */
export function blockedByQuietHours(quiet: QuietHours | null, urgency: Urgency, now = new Date()): boolean {
  if (!quiet?.enabled || urgency === "critical") return false;
  const tz = quiet.timezone || "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false });
  const [h, m] = fmt.format(now).split(":").map(Number);
  const minutes = h * 60 + m;
  const [sh, sm] = quiet.start.split(":").map(Number);
  const [eh, em] = quiet.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
