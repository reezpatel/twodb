import { useState } from "react";
import { Link } from "react-router";
import { SettingsCalendarPreferences, type CalendarPreferences } from "@/components/blocks/settings/calendar/settings-calendar-preferences";
import { SettingsCalendars } from "@/components/blocks/settings/calendar/settings-calendars";
import { browserTz, timezoneOptions } from "../../calendar/calendar-api";
import { CalendarDetailDialog } from "./calendar-detail-dialog";
import { useCalendarSettingsSection } from "./use-calendar-settings";

export function CalendarSettingsSection() {
  const s = useCalendarSettingsSection();
  const [open, setOpen] = useState<string | null>(null);
  // Edits live in a draft until saved; it falls back to the server values until the user touches something.
  const [draft, setDraft] = useState<CalendarPreferences | null>(null);
  const calendars = s.calendars.data ?? [];
  const selected = calendars.find((c) => c.id === open) ?? null;
  const saved = s.settings.data;
  const value = draft ?? saved;

  const writable = calendars.filter((c) => (c.role === "owner" || c.role === "editor") && c.kind !== "subscription");

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsCalendars
        calendars={calendars.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          subtitle: c.accountAddress ?? (c.kind === "subscription" ? "subscription" : "twodb"),
          role: c.role.replace("_", "/"),
          primary: c.isPrimary,
          subscription: c.kind === "subscription",
          feed: c.hasFeed,
          notSynced: !!c.accountId && !c.syncEnabled,
          hidden: c.hidden,
        }))}
        loading={s.calendars.isPending}
        note={
          <>
            twodb calendars live only here (no approval needed). Provider calendars sync with their account; your edits wait in Pending push. Connect Google,
            Microsoft or CalDAV calendars in{" "}
            <Link to="/apps/settings/accounts" className="text-foreground underline">
              Accounts
            </Link>
            .
          </>
        }
        onOpen={setOpen}
        onCreate={(input) => s.createCalendar.mutate(input)}
        creating={s.createCalendar.isPending}
        holidayPresets={s.meta.data?.holidayPresets ?? []}
        error={s.createCalendar.error?.message ?? null}
      />

      {value ? (
        <SettingsCalendarPreferences
          value={value}
          onChange={setDraft}
          zones={timezoneOptions([value.timezone, value.secondaryTimezone])}
          browserZone={browserTz()}
          calendarOptions={writable.map((c) => ({ id: c.id, label: `${c.name} · ${c.accountAddress ?? "twodb"}` }))}
          dirty={draft !== null && JSON.stringify(draft) !== JSON.stringify(saved)}
          saving={s.saveSettings.isPending}
          onSave={() => draft && s.saveSettings.mutate(draft, { onSuccess: () => setDraft(null) })}
        />
      ) : (
        <SettingsCalendars calendars={[]} loading onOpen={() => {}} />
      )}

      <CalendarDetailDialog calendar={selected} onClose={() => setOpen(null)} />
    </div>
  );
}
