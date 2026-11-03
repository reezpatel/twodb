import type { ComponentProps, ReactNode } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsCard, SettingsCardHeader, SettingsCardRow, SettingsRowText } from "../settings-card";

export type CalendarView = "day" | "4day" | "week" | "month" | "agenda" | "year";
export type CalendarToggle = "showWeekends" | "showDeclined" | "showWeekNumbers" | "dimPast" | "speedyMeetings" | "desktopNotifications" | "dailyAgendaEmail";

export interface WorkingHours {
  day: number;
  start: string;
  end: string;
  location?: string | null;
}

/** The user's calendar preferences — same shape the server stores. */
export interface CalendarPreferences {
  /** "" follows the device. */
  timezone: string;
  secondaryTimezone: string | null;
  weekStart: 0 | 1 | 6;
  defaultView: CalendarView;
  defaultDurationMin: number;
  speedyMeetings: boolean;
  showWeekends: boolean;
  showDeclined: boolean;
  showWeekNumbers: boolean;
  dimPast: boolean;
  workingHours: WorkingHours[];
  autoAddInvites: "always" | "responded" | "never";
  /** null = the primary twodb calendar. */
  defaultCalendarId: string | null;
  dailyAgendaEmail: boolean;
  desktopNotifications: boolean;
}

export interface CalendarOption {
  id: string;
  label: string;
}

export interface SettingsCalendarPreferencesProps extends Omit<ComponentProps<typeof SettingsCard>, "onChange"> {
  value: CalendarPreferences;
  onChange: (next: CalendarPreferences) => void;
  /** IANA zones offered in the time-zone pickers. */
  zones: string[];
  /** The device's zone, shown in the "Follow this device" option. */
  browserZone: string;
  /** Calendars new events can be created in. */
  calendarOptions: CalendarOption[];
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TOGGLES: { name: CalendarToggle; label: string; hint?: string }[] = [
  { name: "showWeekends", label: "Show weekends" },
  { name: "showDeclined", label: "Show declined events" },
  { name: "showWeekNumbers", label: "Show week numbers" },
  { name: "dimPast", label: "Dim past events" },
  { name: "speedyMeetings", label: "Speedy meetings", hint: "End meetings 5–10 minutes early." },
  { name: "desktopNotifications", label: "Desktop notifications" },
  { name: "dailyAgendaEmail", label: "Daily agenda email" },
];

// Radix Select can't hold an empty value, so "no explicit choice" travels as a sentinel.
const BROWSER = "__browser";
const NONE = "__none";
const AUTO = "__auto";

function Row({
  title,
  description,
  htmlFor,
  children,
  last,
}: {
  title: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <SettingsCardRow divider={!last} className="flex items-center justify-between gap-4">
      <SettingsRowText title={title} description={description} htmlFor={htmlFor} />
      {children}
    </SettingsCardRow>
  );
}

/** How the calendar looks and behaves for the user: pickers, switches and weekly working hours, saved together. Controlled. */
export function SettingsCalendarPreferences({
  value,
  onChange,
  zones,
  browserZone,
  calendarOptions,
  dirty,
  saving,
  onSave,
  className,
  ...props
}: SettingsCalendarPreferencesProps) {
  const set = <K extends keyof CalendarPreferences>(key: K, next: CalendarPreferences[K]) => onChange({ ...value, [key]: next });
  const zoneItems = zones.map((zone) => (
    <SelectItem key={zone} value={zone}>
      {zone.replace(/_/g, " ")}
    </SelectItem>
  ));

  const setHours = (day: number, next: WorkingHours | null) =>
    set(
      "workingHours",
      [...value.workingHours.filter((w) => w.day !== day), ...(next ? [next] : [])].sort((a, b) => a.day - b.day),
    );

  return (
    <SettingsCard data-slot="settings-calendar-preferences" className={className} {...props}>
      <SettingsCardHeader icon={SlidersHorizontal} title="Preferences">
        <Button type="button" size="sm" variant="secondary" disabled={!dirty || saving} onClick={onSave}>
          {saving ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
      </SettingsCardHeader>

      <Row title="Time zone" htmlFor="cal-tz">
        <Select value={value.timezone || BROWSER} onValueChange={(v) => set("timezone", v === BROWSER ? "" : v)}>
          <SelectTrigger id="cal-tz" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={BROWSER}>Follow this device ({browserZone})</SelectItem>
            {zoneItems}
          </SelectContent>
        </Select>
      </Row>

      <Row title="Secondary time zone" description="Shown alongside the main one in the day and week views." htmlFor="cal-tz2">
        <Select value={value.secondaryTimezone ?? NONE} onValueChange={(v) => set("secondaryTimezone", v === NONE ? null : v)}>
          <SelectTrigger id="cal-tz2" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>None</SelectItem>
            {zoneItems}
          </SelectContent>
        </Select>
      </Row>

      <Row title="Week starts on" htmlFor="cal-week">
        <Select value={String(value.weekStart)} onValueChange={(v) => set("weekStart", Number(v) as 0 | 1 | 6)}>
          <SelectTrigger id="cal-week" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Monday</SelectItem>
            <SelectItem value="0">Sunday</SelectItem>
            <SelectItem value="6">Saturday</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      <Row title="Default view" htmlFor="cal-view">
        <Select value={value.defaultView} onValueChange={(v) => set("defaultView", v as CalendarView)}>
          <SelectTrigger id="cal-view" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="4day">4 days</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="agenda">Schedule</SelectItem>
            {value.defaultView === "year" ? <SelectItem value="year">Year</SelectItem> : null}
          </SelectContent>
        </Select>
      </Row>

      <Row title="Default event length" description="Minutes." htmlFor="cal-duration">
        <Input
          id="cal-duration"
          type="number"
          min={5}
          max={480}
          step={5}
          className="h-8 w-24 text-right text-sm"
          value={value.defaultDurationMin}
          onChange={(e) => set("defaultDurationMin", Number(e.target.value))}
        />
      </Row>

      <Row title="Default calendar" description="Where new events are created." htmlFor="cal-default">
        <Select value={value.defaultCalendarId ?? AUTO} onValueChange={(v) => set("defaultCalendarId", v === AUTO ? null : v)}>
          <SelectTrigger id="cal-default" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>Primary twodb calendar</SelectItem>
            {calendarOptions.map((calendar) => (
              <SelectItem key={calendar.id} value={calendar.id}>
                {calendar.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row title="Add invitations from email" htmlFor="cal-invites">
        <Select value={value.autoAddInvites} onValueChange={(v) => set("autoAddInvites", v as CalendarPreferences["autoAddInvites"])}>
          <SelectTrigger id="cal-invites" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always</SelectItem>
            <SelectItem value="responded">Only when I respond</SelectItem>
            <SelectItem value="never">Never (card only)</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      {TOGGLES.map((toggle) => (
        <Row key={toggle.name} title={toggle.label} description={toggle.hint} htmlFor={`cal-${toggle.name}`}>
          <Switch id={`cal-${toggle.name}`} checked={value[toggle.name]} onCheckedChange={(on) => set(toggle.name, on)} />
        </Row>
      ))}

      <SettingsCardRow className="flex flex-col gap-3">
        <SettingsRowText title="Working hours" description="Days you're available, and when." />
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((label, day) => {
            const hours = value.workingHours.find((w) => w.day === day);
            return (
              <div key={day} className={cn("bg-foreground/4 flex flex-col gap-1.5 rounded-sm p-2 text-xs", !hours && "opacity-70")}>
                <label className="text-foreground flex items-center justify-between font-medium">
                  {label}
                  <Switch
                    checked={!!hours}
                    onCheckedChange={(on) => setHours(day, on ? { day, start: "09:00", end: "17:00" } : null)}
                    aria-label={`Work on ${label}`}
                  />
                </label>
                {hours ? (
                  <>
                    <Input
                      type="time"
                      className="h-7 px-1 text-xs"
                      value={hours.start}
                      onChange={(e) => setHours(day, { ...hours, start: e.target.value })}
                      aria-label={`${label} start`}
                    />
                    <Input
                      type="time"
                      className="h-7 px-1 text-xs"
                      value={hours.end}
                      onChange={(e) => setHours(day, { ...hours, end: e.target.value })}
                      aria-label={`${label} end`}
                    />
                  </>
                ) : (
                  <span className="text-muted-foreground/70">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCardRow>
    </SettingsCard>
  );
}
