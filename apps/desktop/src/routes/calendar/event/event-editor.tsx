import { useState } from "react";
import { useStore } from "@tanstack/react-form";
import { Bell, CalendarClock, ChevronDown, Clock, Loader2, MapPin, Plus, Repeat, Users, Video, X } from "lucide-react";
import { AddressInput } from "@/components/address-input/address-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { RichEditor } from "../../email/compose/rich-editor";
import { timezoneOptions, toWall, type CalendarItem, type CalendarSettings, type Occurrence, type RecurrenceScope } from "../calendar-api";
import { FindATime } from "../scheduling/find-a-time";
import type { EditorState } from "../use-calendar-scene";
import { presetLabel, WEEKDAY_CODES, type RepeatPreset } from "./recurrence";
import { hhmm, toMinutes, useEventEditor, useEventEditorData } from "./use-event-editor";

const REPEATS: RepeatPreset[] = ["none", "daily", "weekdays", "weekly", "monthly_date", "monthly_nth", "yearly", "custom"];
const REMINDER_MINUTES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const COLORS = ["", "#d50000", "#e67c73", "#f4511e", "#f6bf26", "#33b679", "#0b8043", "#039be5", "#3f51b5", "#7986cb", "#8e24aa", "#616161"];

function minutesLabel(m: number) {
  if (m === 0) return "At start";
  if (m < 60) return `${m} min before`;
  if (m < 1440) return `${m / 60} h before`;
  if (m < 10080) return `${m / 1440} day${m === 1440 ? "" : "s"} before`;
  return "1 week before";
}

interface EventEditorProps {
  state: EditorState;
  tz: string;
  settings: CalendarSettings | undefined;
  calendars: CalendarItem[];
  defaultCalendarId: string | undefined;
  onClose: () => void;
  onSaved: (providerCalendar: boolean) => void;
  askScope: (occurrence: Occurrence, run: (scope: RecurrenceScope) => void) => void;
}

export function EventEditor(props: EventEditorProps) {
  const detail = useEventEditorData(props.state.eventId);
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.state.eventId ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription className="sr-only">Event details</DialogDescription>
        </DialogHeader>
        {props.state.eventId && !detail.data ? (
          <Loader2 className="text-muted-foreground m-auto animate-spin" />
        ) : (
          <EditorForm key={detail.data?.event.id ?? "new"} {...props} detail={detail.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorForm(props: EventEditorProps & { detail: ReturnType<typeof useEventEditorData>["data"] }) {
  const { form, save, isEdit } = useEventEditor(props, props.detail);
  const [more, setMore] = useState(false);
  const [findTime, setFindTime] = useState(false);
  const values = useStore(form.store, (s) => s.values);
  const calendar = props.calendars.find((c) => c.id === values.calendarId);
  const selectable = props.calendars.filter(
    (c) =>
      (c.role === "owner" || c.role === "editor") &&
      c.kind !== "subscription" &&
      (!isEdit || (c.accountId ?? null) === (props.calendars.find((x) => x.id === props.detail?.event.calendarId)?.accountId ?? null)),
  );
  const conferenceTypes = calendar?.accountId
    ? (calendar.allowedConference.length ? calendar.allowedConference : ["meet", "teams"]).filter((t) => t === "meet" || t === "teams")
    : [];
  const timezones = timezoneOptions([props.tz, values.timezone]);
  const durationMin = Math.max(15, toMinutes(values.endTime) - toMinutes(values.startTime) + (values.endDate > values.startDate ? 1440 : 0));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            autoFocus
            aria-label="Title"
            placeholder="Add title"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            className="h-10 text-lg font-semibold"
          />
        )}
      </form.Field>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clock size={15} className="text-muted-foreground" />
          <form.Field name="startDate">
            {(field) => (
              <Input
                type="date"
                aria-label="Start date"
                className="w-36"
                value={field.state.value}
                onChange={(e) => {
                  const delta = new Date(`${e.target.value}T00:00:00Z`).getTime() - new Date(`${field.state.value}T00:00:00Z`).getTime();
                  field.handleChange(e.target.value);
                  const end = new Date(new Date(`${form.getFieldValue("endDate")}T00:00:00Z`).getTime() + delta).toISOString().slice(0, 10);
                  if (!Number.isNaN(delta)) form.setFieldValue("endDate", end);
                }}
              />
            )}
          </form.Field>
          {!values.isAllDay ? (
            <form.Field name="startTime">
              {(field) => (
                <Input
                  type="time"
                  aria-label="Start time"
                  className="w-28"
                  value={field.state.value}
                  onChange={(e) => {
                    const prev = toMinutes(field.state.value);
                    const next = toMinutes(e.target.value);
                    field.handleChange(e.target.value);
                    const end = toMinutes(form.getFieldValue("endTime")) + (next - prev);
                    form.setFieldValue("endTime", hhmm(((end % 1440) + 1440) % 1440));
                  }}
                />
              )}
            </form.Field>
          ) : null}
          <span className="text-muted-foreground">–</span>
          {!values.isAllDay ? (
            <form.Field name="endTime">
              {(field) => (
                <Input type="time" aria-label="End time" className="w-28" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              )}
            </form.Field>
          ) : null}
          <form.Field name="endDate">
            {(field) => (
              <Input
                type="date"
                aria-label="End date"
                className="w-36"
                value={field.state.value}
                min={values.startDate}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </div>
        <div className="flex flex-wrap items-center gap-4 pl-6">
          <form.Field name="isAllDay">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.state.value} onCheckedChange={field.handleChange} /> All day
              </label>
            )}
          </form.Field>
          {!values.isAllDay ? (
            <form.Field name="timezone">
              {(field) => (
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger size="sm" className="w-56" aria-label="Time zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timezones.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          ) : null}
          <form.Field name="repeat">
            {(field) => (
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as RepeatPreset)}>
                <SelectTrigger size="sm" className="w-64" aria-label="Repeat">
                  <Repeat size={13} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEATS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {presetLabel(r, values.startDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </form.Field>
        </div>
        {values.repeat === "custom" ? (
          <div className="ml-6 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-2">
              Every
              <form.Field name="custom.interval">
                {(field) => (
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    className="w-16"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Math.max(1, Number(e.target.value)))}
                  />
                )}
              </form.Field>
              <form.Field name="custom.freq">
                {(field) => (
                  <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as typeof field.state.value)}>
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">day(s)</SelectItem>
                      <SelectItem value="WEEKLY">week(s)</SelectItem>
                      <SelectItem value="MONTHLY">month(s)</SelectItem>
                      <SelectItem value="YEARLY">year(s)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </form.Field>
            </div>
            {values.custom.freq === "WEEKLY" ? (
              <form.Field name="custom.byday">
                {(field) => (
                  <div className="flex gap-1">
                    {WEEKDAY_CODES.map((code) => {
                      const on = field.state.value.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          aria-pressed={on}
                          onClick={() => field.handleChange(on ? field.state.value.filter((c) => c !== code) : [...field.state.value, code])}
                          className={cn(
                            "grid size-7 place-items-center rounded-full border text-xs",
                            on && "bg-primary text-primary-foreground border-primary",
                          )}
                        >
                          {code.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </form.Field>
            ) : null}
            <form.Field name="custom.end">
              {(field) => (
                <div className="flex flex-wrap items-center gap-2">
                  Ends
                  <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as typeof field.state.value)}>
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="until">On date</SelectItem>
                      <SelectItem value="count">After</SelectItem>
                    </SelectContent>
                  </Select>
                  {field.state.value === "until" ? (
                    <form.Field name="custom.until">
                      {(f) => <Input type="date" className="w-36" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />}
                    </form.Field>
                  ) : null}
                  {field.state.value === "count" ? (
                    <form.Field name="custom.count">
                      {(f) => (
                        <span className="flex items-center gap-1">
                          <Input type="number" min={1} className="w-16" value={f.state.value} onChange={(e) => f.handleChange(Number(e.target.value))} /> times
                        </span>
                      )}
                    </form.Field>
                  ) : null}
                </div>
              )}
            </form.Field>
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-2">
        <Users size={15} className="text-muted-foreground mt-2" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <form.Field name="guests">
            {(field) => (
              <div className="rounded-md border px-2 py-1">
                <AddressInput
                  id="event-guests"
                  placeholder="Add guests"
                  scope={{ calendarId: values.calendarId }}
                  value={field.state.value}
                  onChange={(list) =>
                    field.handleChange(list.map((a) => ({ ...a, optional: field.state.value.find((g) => g.address === a.address)?.optional ?? false })))
                  }
                  chipExtra={(a) => {
                    const g = field.state.value.find((x) => x.address === a.address);
                    return (
                      <button
                        type="button"
                        className={cn("text-[10px]", g?.optional ? "text-primary" : "text-muted-foreground")}
                        aria-label={g?.optional ? "Make required" : "Make optional"}
                        onClick={() => field.handleChange(field.state.value.map((x) => (x.address === a.address ? { ...x, optional: !x.optional } : x)))}
                      >
                        {g?.optional ? "optional" : "req"}
                      </button>
                    );
                  }}
                />
              </div>
            )}
          </form.Field>
          {values.guests.length && !values.isAllDay ? (
            <button type="button" className="text-primary self-start text-xs" onClick={() => setFindTime((v) => !v)}>
              {findTime ? "Hide availability" : "Find a time"}
            </button>
          ) : null}
          {findTime && values.guests.length && !values.isAllDay ? (
            <FindATime
              calendarId={values.calendarId}
              attendees={values.guests.map((g) => g.address)}
              durationMin={durationMin}
              day={values.startDate}
              tz={values.timezone}
              selected={null}
              onPick={(start, end) => {
                const s = toWall(start, values.timezone);
                const e = toWall(end, values.timezone);
                form.setFieldValue("startDate", s.date);
                form.setFieldValue("startTime", hhmm(s.minutes));
                form.setFieldValue("endDate", e.date);
                form.setFieldValue("endTime", hhmm(e.minutes));
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MapPin size={15} className="text-muted-foreground" />
        <form.Field name="location">
          {(field) => <Input placeholder="Add location" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
        </form.Field>
      </div>

      <div className="flex items-center gap-2">
        <Video size={15} className="text-muted-foreground" />
        <form.Field name="conference">
          {(field) => (
            <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as typeof field.state.value)}>
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No video call</SelectItem>
                {conferenceTypes.includes("meet") ? <SelectItem value="meet">Google Meet</SelectItem> : null}
                {conferenceTypes.includes("teams") ? <SelectItem value="teams">Microsoft Teams</SelectItem> : null}
                <SelectItem value="link">Other link (Zoom, …)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </form.Field>
        {values.conference === "link" ? (
          <form.Field name="conferenceUrl">
            {(field) => <Input placeholder="https://" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
          </form.Field>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-muted-foreground" />
        <form.Field name="calendarId">
          {(field) => (
            <Select value={field.state.value} onValueChange={field.handleChange}>
              <SelectTrigger size="sm" className="w-72" aria-label="Calendar">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: calendar?.color }} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <span className="text-muted-foreground ml-1 text-xs">{c.accountAddress ?? "twodb"}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>
        <form.Field name="color">
          {(field) => (
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c || "default"}
                  type="button"
                  aria-label={c ? `Color ${c}` : "Calendar color"}
                  onClick={() => field.handleChange(c)}
                  className={cn("size-5 rounded-full border-2", field.state.value === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c || calendar?.color }}
                />
              ))}
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex items-start gap-2">
        <Bell size={15} className="text-muted-foreground mt-2" />
        <div className="flex flex-1 flex-col gap-1.5">
          <form.Field name="useDefaultReminders">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.state.value} onCheckedChange={field.handleChange} /> Calendar default reminders
              </label>
            )}
          </form.Field>
          {!values.useDefaultReminders ? (
            <form.Field name="reminders">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  {field.state.value.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={r.method}
                        onValueChange={(m) => field.handleChange(field.state.value.map((x, j) => (j === i ? { ...x, method: m as "popup" | "email" } : x)))}
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popup">Notification</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(r.minutes)}
                        onValueChange={(m) => field.handleChange(field.state.value.map((x, j) => (j === i ? { ...x, minutes: Number(m) } : x)))}
                      >
                        <SelectTrigger size="sm" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMINDER_MINUTES.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {minutesLabel(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Remove reminder"
                        onClick={() => field.handleChange(field.state.value.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  {field.state.value.length < 5 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="self-start"
                      onClick={() => field.handleChange([...field.state.value, { method: "popup", minutes: 10 }])}
                    >
                      <Plus /> Add reminder
                    </Button>
                  ) : null}
                </div>
              )}
            </form.Field>
          ) : null}
          {calendar?.accountId && calendar.role !== "owner" ? (
            <span className="text-muted-foreground text-[11px]">Reminders on a shared calendar stay in twodb (personal).</span>
          ) : null}
        </div>
      </div>

      <form.Field name="description">
        {(field) => <RichEditor value={field.state.value} onChange={field.handleChange} className="min-h-24 rounded-md border p-2" />}
      </form.Field>

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-xs"
        onClick={() => setMore((v) => !v)}
      >
        <ChevronDown size={13} className={cn("transition-transform", more && "rotate-180")} /> More options
      </button>
      {more ? (
        <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
          <form.Field name="transparency">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label>Show as</Label>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as "opaque" | "transparent")}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opaque">Busy</SelectItem>
                    <SelectItem value="transparent">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="visibility">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label>Visibility</Label>
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Calendar default</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="eventType">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Event</SelectItem>
                    <SelectItem value="out_of_office">Out of office</SelectItem>
                    <SelectItem value="focus_time">Focus time</SelectItem>
                    <SelectItem value="working_location">Working location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          {(["guestsCanModify", "guestsCanInviteOthers", "guestsCanSeeOthers"] as const).map((name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={field.state.value} onCheckedChange={(v) => field.handleChange(v === true)} />
                  {name === "guestsCanModify"
                    ? "Guests can modify"
                    : name === "guestsCanInviteOthers"
                      ? "Guests can invite others"
                      : "Guests can see guest list"}
                </label>
              )}
            </form.Field>
          ))}
        </div>
      ) : null}

      <DialogFooter className="items-center">
        {save.error ? (
          <span className="text-destructive mr-auto text-xs">{save.error.message}</span>
        ) : calendar?.accountId ? (
          <span className="text-muted-foreground mr-auto text-xs">Saved in twodb now; sent to {calendar.accountAddress} after approval in Pending push.</span>
        ) : null}
        <Button type="button" variant="ghost" onClick={props.onClose}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting || !values.calendarId}>
              {submitting ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
