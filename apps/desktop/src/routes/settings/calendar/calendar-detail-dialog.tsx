import { useRef, useState } from "react";
import { Copy, Link2, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CalendarItem, ReminderSpec } from "../../calendar/calendar-api";
import { useCalendarSettingsSection, useCalendarShares } from "./use-calendar-settings";

const COLORS = ["#4f7cff", "#039be5", "#33b679", "#0b8043", "#f6bf26", "#f4511e", "#d50000", "#e67c73", "#8e24aa", "#7986cb", "#616161"];
const MINUTES = [0, 5, 10, 15, 30, 60, 1440];

function Sharing({ calendar }: { calendar: CalendarItem }) {
  const s = useCalendarShares(calendar);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("viewer");
  const org = s.shares.data?.find((x) => x.principalType === "org");
  return (
    <div className="flex flex-col gap-2">
      <Label>Share with your organization</Label>
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">Everyone in the organization</span>
        <Select
          value={org?.role ?? "none"}
          onValueChange={(v) => (v === "none" ? org && s.removeShare.mutate(org.id) : s.setShare.mutate({ principalType: "org", role: v }))}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not shared</SelectItem>
            <SelectItem value="free_busy">See free/busy</SelectItem>
            <SelectItem value="viewer">See all details</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(s.shares.data ?? [])
        .filter((x) => x.principalType === "user")
        .map((x) => (
          <div key={x.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{x.name ?? x.email}</span>
            <span className="text-muted-foreground text-xs">{x.role.replace("_", "/")}</span>
            <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => s.removeShare.mutate(x.id)}>
              <X />
            </Button>
          </div>
        ))}
      <div className="flex gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Add a person" />
          </SelectTrigger>
          <SelectContent>
            {(s.orgUsers.data ?? [])
              .filter((u) => u.id !== calendar.ownerUserId)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free_busy">Free/busy</SelectItem>
            <SelectItem value="viewer">See details</SelectItem>
            <SelectItem value="editor">Make changes</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!userId}
          onClick={() => s.setShare.mutate({ principalType: "user", principal: userId, role }, { onSuccess: () => setUserId("") })}
        >
          <Plus />
        </Button>
      </div>
      {s.setShare.error ? <span className="text-destructive text-xs">{s.setShare.error.message}</span> : null}
    </div>
  );
}

export function CalendarDetailDialog({ calendar, onClose }: { calendar: CalendarItem | null; onClose: () => void }) {
  const s = useCalendarSettingsSection();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!calendar) return null;
  const owner = calendar.role === "owner";
  const local = !calendar.accountId;
  const reminders = calendar.defaultReminders;
  const setReminders = (next: ReminderSpec[]) => s.updateCalendar.mutate({ id: calendar.id, patch: { defaultReminders: next } });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{calendar.name}</DialogTitle>
          <DialogDescription>
            {local
              ? calendar.kind === "subscription"
                ? "Subscribed calendar (read-only)"
                : "twodb calendar"
              : `${calendar.accountAddress} · ${calendar.accessRole}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {local && owner && calendar.kind !== "subscription" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-name">Name</Label>
              <Input
                id="cal-name"
                defaultValue={calendar.name}
                onBlur={(e) =>
                  e.target.value.trim() && e.target.value !== calendar.name && s.updateCalendar.mutate({ id: calendar.id, patch: { name: e.target.value } })
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-alias">Display name (only for you)</Label>
              <Input
                id="cal-alias"
                defaultValue={calendar.name}
                onBlur={(e) => s.updateCalendar.mutate({ id: calendar.id, patch: { nameOverride: e.target.value || null } })}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={`size-6 rounded-full border-2 ${calendar.color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => s.updateCalendar.mutate({ id: calendar.id, patch: local && owner ? { color: c } : { colorOverride: c } })}
                />
              ))}
            </div>
          </div>
          {calendar.accountId ? (
            <label className="flex items-center justify-between text-sm">
              Sync this calendar
              <Switch
                checked={calendar.syncEnabled}
                disabled={calendar.role === "viewer"}
                onCheckedChange={(v) => s.updateCalendar.mutate({ id: calendar.id, patch: { syncEnabled: v } })}
              />
            </label>
          ) : null}
          {calendar.kind !== "subscription" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Default reminders</Label>
              {reminders.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={r.method}
                    onValueChange={(m) => setReminders(reminders.map((x, j) => (j === i ? { ...x, method: m as "popup" | "email" } : x)))}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popup">Notification</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(r.minutes)} onValueChange={(m) => setReminders(reminders.map((x, j) => (j === i ? { ...x, minutes: Number(m) } : x)))}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m === 0 ? "At start" : m < 60 ? `${m} min before` : m === 60 ? "1 hour before" : "1 day before"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs">
                    <Switch checked={!!r.allDay} onCheckedChange={(v) => setReminders(reminders.map((x, j) => (j === i ? { ...x, allDay: v } : x)))} /> all-day
                  </label>
                  <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setReminders(reminders.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="xs" className="self-start" onClick={() => setReminders([...reminders, { method: "popup", minutes: 10 }])}>
                <Plus /> Add
              </Button>
            </div>
          ) : null}
          {local && owner && calendar.kind !== "subscription" ? <Sharing calendar={calendar} /> : null}
          {local && owner ? (
            <div className="flex flex-col gap-2">
              <Label>Private ICS feed</Label>
              <p className="text-muted-foreground text-xs">A secret URL other apps (phone, Outlook) can subscribe to. Read-only.</p>
              {feedUrl ? (
                <div className="flex gap-2">
                  <Input readOnly value={feedUrl} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" aria-label="Copy feed URL" onClick={() => void navigator.clipboard.writeText(feedUrl)}>
                    <Copy />
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => s.feed.mutate({ id: calendar.id, enabled: true }, { onSuccess: (r) => setFeedUrl(r.url) })}>
                  <Link2 /> {calendar.hasFeed ? "Rotate URL" : "Create URL"}
                </Button>
                {calendar.hasFeed ? (
                  <Button size="sm" variant="ghost" onClick={() => s.feed.mutate({ id: calendar.id, enabled: false }, { onSuccess: () => setFeedUrl(null) })}>
                    Turn off
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/calendar/calendars/${calendar.id}/export.ics`} download>
                Export .ics
              </a>
            </Button>
            {local && owner && calendar.kind !== "subscription" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ics,text/calendar"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) s.importIcs.mutate({ id: calendar.id, file });
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="outline" disabled={s.importIcs.isPending} onClick={() => fileRef.current?.click()}>
                  <Upload /> Import .ics
                </Button>
              </>
            ) : null}
            {calendar.kind === "subscription" || calendar.accountId ? (
              <Button size="sm" variant="outline" disabled={s.syncCalendar.isPending} onClick={() => s.syncCalendar.mutate(calendar.id)}>
                <RefreshCw /> Refresh
              </Button>
            ) : null}
            {local && owner && !calendar.isPrimary ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive ml-auto"
                onClick={() => window.confirm(`Delete ${calendar.name}?`) && s.deleteCalendar.mutate(calendar.id, { onSuccess: onClose })}
              >
                <Trash2 /> Delete
              </Button>
            ) : null}
          </div>
          {s.importIcs.data ? <p className="text-muted-foreground text-xs">Imported {s.importIcs.data.imported} events.</p> : null}
          {s.importIcs.error ? <p className="text-destructive text-xs">{s.importIcs.error.message}</p> : null}
          {calendar.lastError ? <p className="text-destructive text-xs">{calendar.lastError}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
