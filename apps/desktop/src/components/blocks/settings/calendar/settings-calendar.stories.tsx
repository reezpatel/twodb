import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsCalendarPreferences, type CalendarPreferences } from "./settings-calendar-preferences";
import { SettingsCalendars, type SettingsCalendar } from "./settings-calendars";

const CALENDARS: SettingsCalendar[] = [
  { id: "c1", name: "Personal", color: "#3b82f6", subtitle: "twodb", role: "owner", primary: true },
  { id: "c2", name: "Work", color: "#10b981", subtitle: "ava@work.dev", role: "editor/approver", feed: true },
  { id: "c3", name: "Team vacations", color: "#f59e0b", subtitle: "ava@example.com", role: "reader", notSynced: true },
  { id: "c4", name: "Holidays · Germany", color: "#ef4444", subtitle: "subscription", role: "reader", subscription: true },
  { id: "c5", name: "Old project", color: "#8b5cf6", subtitle: "twodb", role: "owner", hidden: true },
];

const PRESETS = [
  { id: "de", label: "Germany", url: "https://example.com/de.ics" },
  { id: "us", label: "United States", url: "https://example.com/us.ics" },
];

const PREFS: CalendarPreferences = {
  timezone: "",
  secondaryTimezone: null,
  weekStart: 1,
  defaultView: "week",
  defaultDurationMin: 30,
  speedyMeetings: true,
  showWeekends: true,
  showDeclined: false,
  showWeekNumbers: false,
  dimPast: true,
  workingHours: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00" })),
  autoAddInvites: "responded",
  defaultCalendarId: null,
  dailyAgendaEmail: false,
  desktopNotifications: true,
};

const meta = {
  title: "Blocks/Settings/Calendar/Calendars",
  component: SettingsCalendars,
  parameters: { layout: "padded" },
  args: {
    calendars: CALENDARS,
    note: "twodb calendars live only here (no approval needed). Provider calendars sync with their account; your edits wait in Pending push.",
    onOpen: () => {},
    onCreate: () => {},
    holidayPresets: PRESETS,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsCalendars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** "New" opens the inline form; a holiday preset creates straight away. */
export const Interactive: Story = {
  render: (args) => {
    const [calendars, setCalendars] = useState(args.calendars);
    return (
      <SettingsCalendars
        {...args}
        calendars={calendars}
        onCreate={(input) =>
          setCalendars((cur) => [
            ...cur,
            {
              id: String(Date.now()),
              name: input.name,
              color: "#64748b",
              subtitle: input.subscriptionUrl ? "subscription" : "twodb",
              role: "owner",
              subscription: !!input.subscriptionUrl,
            },
          ])
        }
      />
    );
  },
};

export const ReadOnly: Story = { args: { onCreate: undefined } };

export const Empty: Story = { args: { calendars: [] } };

export const Loading: Story = { args: { calendars: [], loading: true } };

export const WithError: Story = { args: { error: "Couldn't create the calendar." } };

export const Preferences: StoryObj<typeof SettingsCalendarPreferences> = {
  render: () => {
    const [saved, setSaved] = useState(PREFS);
    const [draft, setDraft] = useState(PREFS);
    return (
      <div className="mx-auto max-w-3xl">
        <SettingsCalendarPreferences
          value={draft}
          onChange={setDraft}
          zones={["Europe/Berlin", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"]}
          browserZone="Europe/Berlin"
          calendarOptions={CALENDARS.slice(0, 3).map((c) => ({ id: c.id, label: `${c.name} · ${c.subtitle}` }))}
          dirty={JSON.stringify(draft) !== JSON.stringify(saved)}
          onSave={() => setSaved(draft)}
        />
      </div>
    );
  },
};

export const PreferencesSaving: StoryObj<typeof SettingsCalendarPreferences> = {
  render: () => (
    <div className="mx-auto max-w-3xl">
      <SettingsCalendarPreferences value={PREFS} onChange={() => {}} zones={["Europe/Berlin"]} browserZone="Europe/Berlin" calendarOptions={[]} dirty saving />
    </div>
  ),
};
