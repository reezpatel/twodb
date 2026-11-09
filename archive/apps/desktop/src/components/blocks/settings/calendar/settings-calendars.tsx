import { useState, type ComponentProps, type ReactNode } from "react";
import { CalendarDays, CalendarPlus, Globe, Loader2, Rss } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export interface SettingsCalendar {
  id: string;
  name: string;
  color: string;
  /** Muted line under the name: the account address, "twodb" or "subscription". */
  subtitle: string;
  /** Access, e.g. "owner" or "editor/approver". */
  role: string;
  primary?: boolean;
  subscription?: boolean;
  feed?: boolean;
  notSynced?: boolean;
  hidden?: boolean;
}

export interface HolidayPreset {
  id: string;
  label: string;
  url: string;
}

export interface NewCalendarInput {
  name: string;
  subscriptionUrl?: string;
}

export interface SettingsCalendarsProps extends Omit<ComponentProps<typeof SettingsCard>, "onSelect"> {
  calendars: SettingsCalendar[];
  loading?: boolean;
  /** Intro text under the header (can hold links). */
  note?: ReactNode;
  /** Opens a calendar's detail dialog. */
  onOpen: (id: string) => void;
  /** Creates a calendar. Without it the "New calendar" button is hidden. */
  onCreate?: (input: NewCalendarInput) => void;
  creating?: boolean;
  holidayPresets?: HolidayPreset[];
  error?: string | null;
}

const PILL = "bg-foreground/6 text-muted-foreground rounded-md px-1.5 py-px text-xs leading-5";

/** The user's calendars — twodb-native, provider-synced and subscriptions — as a list that opens a detail dialog, plus an inline "new calendar" form. Controlled. */
export function SettingsCalendars({ calendars, loading, note, onOpen, onCreate, creating, holidayPresets = [], error, ...props }: SettingsCalendarsProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const create = (input: NewCalendarInput) => {
    onCreate?.(input);
    setName("");
    setUrl("");
    setAdding(false);
  };

  return (
    <SettingsCard data-slot="settings-calendars" {...props}>
      <SettingsCardHeader icon={CalendarDays} title="Calendars">
        <span className="text-muted-foreground/70 text-[13px] tabular-nums">{calendars.length} total</span>
        {onCreate ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding((open) => !open)} aria-expanded={adding}>
            <CalendarPlus data-icon="inline-start" /> New
          </Button>
        ) : null}
      </SettingsCardHeader>

      {note ? (
        <SettingsCardRow divider className="py-3">
          <p className="text-muted-foreground/70 text-xs">{note}</p>
        </SettingsCardRow>
      ) : null}

      {adding && onCreate ? (
        <SettingsCardRow divider className="bg-foreground/4 flex flex-col gap-2 py-3">
          <form
            className="grid grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create({ name: name.trim() || "Subscription", subscriptionUrl: url.trim() || undefined });
            }}
          >
            <Input
              autoFocus
              className="h-8 text-sm"
              placeholder="Calendar name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Calendar name"
            />
            <Input
              className="h-8 text-sm"
              placeholder="Subscribe to URL (optional, webcal:// or https://)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Subscription URL"
            />
            <div className="col-span-2 flex flex-wrap items-center gap-1.5">
              {holidayPresets.length > 0 ? (
                <>
                  <Globe className="text-muted-foreground size-3.5" aria-hidden="true" />
                  <span className="text-muted-foreground/70 text-xs">Holidays:</span>
                  {holidayPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="bg-foreground/6"
                      onClick={() => create({ name: `Holidays · ${preset.label}`, subscriptionUrl: preset.url })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </>
              ) : null}
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="secondary" disabled={creating}>
                {creating ? <Loader2 className="animate-spin" /> : null} Create
              </Button>
            </div>
          </form>
        </SettingsCardRow>
      ) : null}

      {error ? <p className="text-destructive px-5 py-3 text-xs">{error}</p> : null}

      {loading ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">Loading…</p>
      ) : calendars.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No calendars yet.</p>
      ) : (
        <ul>
          {calendars.map((calendar) => (
            <li key={calendar.id} className={cn("relative last:after:hidden", SETTINGS_DIVIDER)}>
              <button
                type="button"
                onClick={() => onOpen(calendar.id)}
                className="hover:bg-foreground/4 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: calendar.color }} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground truncate text-sm font-medium">{calendar.name}</span>
                  <span className="text-muted-foreground/70 truncate text-xs">{calendar.subtitle}</span>
                </span>
                {calendar.primary ? <span className={PILL}>primary</span> : null}
                {calendar.subscription ? <Rss className="text-muted-foreground size-3.5 shrink-0" aria-label="Subscription" /> : null}
                {calendar.feed ? <span className={PILL}>feed</span> : null}
                {calendar.notSynced ? <span className={PILL}>not synced</span> : null}
                {calendar.hidden ? <span className={PILL}>hidden</span> : null}
                <span className="text-muted-foreground/70 shrink-0 text-xs">{calendar.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
