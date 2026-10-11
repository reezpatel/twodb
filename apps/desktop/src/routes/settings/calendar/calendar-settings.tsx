import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "@tanstack/react-form";
import { CalendarPlus, Globe, Loader2, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { browserTz, timezoneOptions, type CalendarItem, type CalendarSettings } from "../../calendar/calendar-api";
import { CalendarDetailDialog } from "./calendar-detail-dialog";
import { useCalendarSettingsSection, useGeneralForm } from "./use-calendar-settings";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function GeneralForm({
  settings,
  calendars,
  onSave,
}: {
  settings: CalendarSettings;
  calendars: CalendarItem[];
  onSave: (v: Partial<CalendarSettings>) => Promise<unknown>;
}) {
  const form = useGeneralForm(settings, onSave);
  const zones = timezoneOptions([settings.timezone, settings.secondaryTimezone]);
  const writable = calendars.filter((c) => (c.role === "owner" || c.role === "editor") && c.kind !== "subscription");
  const toggle = (
    name: "showWeekends" | "showDeclined" | "showWeekNumbers" | "dimPast" | "speedyMeetings" | "desktopNotifications" | "dailyAgendaEmail",
    label: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <label className="flex items-center justify-between gap-2 text-sm">
          {label}
          <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
        </label>
      )}
    </form.Field>
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <form.Field name="timezone">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Time zone</Label>
              <Select value={field.state.value || "__browser"} onValueChange={(v) => field.handleChange(v === "__browser" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__browser">Follow this device ({browserTz()})</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="secondaryTimezone">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Secondary time zone</Label>
              <Select value={field.state.value ?? "__none"} onValueChange={(v) => field.handleChange(v === "__none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">None</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="weekStart">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Week starts on</Label>
              <Select value={String(field.state.value)} onValueChange={(v) => field.handleChange(Number(v) as 0 | 1 | 6)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="defaultView">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Default view</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as CalendarSettings["defaultView"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="4day">4 days</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="agenda">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="defaultDurationMin">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Default event length (min)</Label>
              <Input type="number" min={5} max={480} step={5} value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value))} />
            </div>
          )}
        </form.Field>
        <form.Field name="defaultCalendarId">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Default calendar for new events</Label>
              <Select value={field.state.value ?? "__auto"} onValueChange={(v) => field.handleChange(v === "__auto" ? null : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto">Primary twodb calendar</SelectItem>
                  {writable.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.accountAddress ?? "twodb"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="autoAddInvites">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>Add invitations from email</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as CalendarSettings["autoAddInvites"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="responded">Only when I respond</SelectItem>
                  <SelectItem value="never">Never (card only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
        {toggle("showWeekends", "Show weekends")}
        {toggle("showDeclined", "Show declined events")}
        {toggle("showWeekNumbers", "Show week numbers")}
        {toggle("dimPast", "Dim past events")}
        {toggle("speedyMeetings", "Speedy meetings (end 5–10 min early)")}
        {toggle("desktopNotifications", "Desktop notifications")}
        {toggle("dailyAgendaEmail", "Daily agenda email")}
      </div>

      <form.Field name="workingHours">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label>Working hours</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((label, day) => {
                const wh = field.state.value.find((w) => w.day === day);
                const set = (next: typeof wh | null) =>
                  field.handleChange([...field.state.value.filter((w) => w.day !== day), ...(next ? [next] : [])].sort((a, b) => a.day - b.day));
                return (
                  <div key={day} className="flex flex-col gap-1 rounded-md border p-1.5 text-xs">
                    <label className="flex items-center justify-between">
                      {label}
                      <Switch checked={!!wh} onCheckedChange={(v) => set(v ? { day, start: "09:00", end: "17:00" } : null)} />
                    </label>
                    {wh ? (
                      <>
                        <Input type="time" className="h-7 px-1 text-xs" value={wh.start} onChange={(e) => set({ ...wh, start: e.target.value })} />
                        <Input type="time" className="h-7 px-1 text-xs" value={wh.end} onChange={(e) => set({ ...wh, end: e.target.value })} />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.isSubmitting, s.isDirty] as const}>
        {([submitting, dirty]) => (
          <Button type="submit" className="self-end" disabled={submitting || !dirty}>
            {submitting ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function NewCalendarForm({
  presets,
  onCreate,
  pending,
}: {
  presets: { id: string; label: string; url: string }[];
  onCreate: (v: { name: string; subscriptionUrl?: string }) => void;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: { name: "", subscriptionUrl: "" },
    onSubmit: ({ value }) => onCreate({ name: value.name || "Subscription", subscriptionUrl: value.subscriptionUrl || undefined }),
  });
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <form.Field name="name">
          {(field) => <Input placeholder="Calendar name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
        </form.Field>
        <form.Field name="subscriptionUrl">
          {(field) => (
            <Input
              placeholder="Subscribe to URL (optional, webcal:// or https://)"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </form.Field>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Globe size={13} className="text-muted-foreground" />
        <span className="text-muted-foreground text-xs">Holidays:</span>
        {presets.map((p) => (
          <Button key={p.id} type="button" size="xs" variant="outline" onClick={() => onCreate({ name: `Holidays · ${p.label}`, subscriptionUrl: p.url })}>
            {p.label}
          </Button>
        ))}
        <Button type="submit" size="sm" className="ml-auto" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Create
        </Button>
      </div>
    </form>
  );
}

export function CalendarSettingsSection() {
  const s = useCalendarSettingsSection();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const calendars = s.calendars.data ?? [];
  const selected = calendars.find((c) => c.id === open) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Calendar</h1>
        <p className="text-muted-foreground text-sm">
          Calendars, defaults and working hours. Connect Google, Microsoft or CalDAV calendars in{" "}
          <Link to="/apps/settings/accounts" className="underline">
            Accounts
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Calendars</CardTitle>
            <CardDescription>
              twodb calendars live only here (no approval needed). Provider calendars sync with their account; your edits wait in Pending push.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setAdding((v) => !v)}>
            <CalendarPlus /> New calendar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {adding ? (
            <NewCalendarForm
              presets={s.meta.data?.holidayPresets ?? []}
              pending={s.createCalendar.isPending}
              onCreate={(v) => s.createCalendar.mutate(v, { onSuccess: () => setAdding(false) })}
            />
          ) : null}
          {s.createCalendar.error ? <p className="text-destructive text-xs">{s.createCalendar.error.message}</p> : null}
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpen(c.id)}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2 text-left"
            >
              <span className="size-3 rounded" style={{ backgroundColor: c.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="text-muted-foreground truncate text-xs">{c.accountAddress ?? (c.kind === "subscription" ? "subscription" : "twodb")}</span>
              </span>
              {c.isPrimary ? <Badge variant="outline">primary</Badge> : null}
              {c.kind === "subscription" ? <Rss size={13} className="text-muted-foreground" /> : null}
              {c.hasFeed ? <Badge variant="secondary">feed</Badge> : null}
              {c.accountId && !c.syncEnabled ? <Badge variant="secondary">not synced</Badge> : null}
              {c.hidden ? <Badge variant="secondary">hidden</Badge> : null}
              <span className="text-muted-foreground text-xs">{c.role.replace("_", "/")}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How the calendar looks and behaves for you.</CardDescription>
        </CardHeader>
        <CardContent>
          {s.settings.data ? (
            <GeneralForm settings={s.settings.data} calendars={calendars} onSave={(v) => s.saveSettings.mutateAsync(v)} />
          ) : (
            <Loader2 className="text-muted-foreground animate-spin" />
          )}
        </CardContent>
      </Card>

      <CalendarDetailDialog calendar={selected} onClose={() => setOpen(null)} />
    </div>
  );
}
