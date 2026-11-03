import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsNotifications, type NotificationCell, type NotificationChannel, type NotificationGroup, type NotificationRow } from "./settings-notifications";

const CHANNELS: NotificationChannel[] = [
  { id: "inApp", label: "In-app" },
  { id: "toast", label: "Toasts" },
  { id: "osPush", label: "Push" },
  { id: "emailDigest", label: "Digest" },
];

const cell = (value: boolean | null, fallback = false): NotificationCell => ({ value, effective: value ?? fallback });

const row = (
  id: string,
  label: string,
  hint: string | null,
  values: Record<string, boolean | null>,
  defaults: Record<string, boolean> = {},
): NotificationRow => ({
  id,
  label,
  hint,
  cells: Object.fromEntries(CHANNELS.map((c) => [c.id, cell(values[c.id] ?? null, defaults[c.id] ?? false)])),
});

const GROUPS: NotificationGroup[] = [
  {
    id: "code",
    label: "Code",
    row: row("code", "Code", "Agent runs and background jobs", { inApp: true, toast: null, osPush: null, emailDigest: null }, { toast: true }),
    types: [
      row("run-finished", "Run finished", "When an agent run completes", { inApp: true, toast: false }, { toast: true, osPush: true }),
      row("job-failed", "Background job failed", "A run_background job exits with an error", { osPush: true }, { inApp: true, toast: true }),
      row("question", "Agent asks a question", "ask_user is waiting on you", {}, { inApp: true, toast: true, osPush: true }),
    ],
  },
  {
    id: "email",
    label: "Email",
    row: row("email", "Email", "New mail and replies", { inApp: true, toast: false, osPush: false, emailDigest: true }),
    types: [
      row("new-mail", "New mail", "A message arrives in a watched inbox", { inApp: true }, { toast: false }),
      row("reply", "Reply to your thread", null, {}),
    ],
  },
  { id: "calendar", label: "Calendar", row: row("calendar", "Calendar", "Invitations and reminders", {}, { inApp: true }), types: [] },
];

const meta = {
  title: "Blocks/Settings/Notifications/Notifications",
  component: SettingsNotifications,
  parameters: { layout: "padded" },
  args: { channels: CHANNELS, groups: GROUPS, onToggle: () => {}, onResetAll: () => {} },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsNotifications>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Toggle any switch; "Reset all" puts everything back to its default. */
export const Interactive: Story = {
  render: (args) => {
    const [groups, setGroups] = useState(args.groups);
    const clear = (r: NotificationRow): NotificationRow => ({
      ...r,
      cells: Object.fromEntries(Object.keys(r.cells).map((k) => [k, { value: null, effective: false }])),
    });
    const patch = (groupId: string, typeId: string | null, fn: (r: NotificationRow) => NotificationRow) =>
      setGroups((cur) =>
        cur.map((g) =>
          g.id !== groupId ? g : typeId === null ? { ...g, row: fn(g.row) } : { ...g, types: g.types.map((t) => (t.id === typeId ? fn(t) : t)) },
        ),
      );
    return (
      <SettingsNotifications
        {...args}
        groups={groups}
        onToggle={(groupId, typeId, channelId, next) =>
          patch(groupId, typeId, (r) => ({ ...r, cells: { ...r.cells, [channelId]: { value: next, effective: next } } }))
        }
        onResetAll={() => setGroups(args.groups.map((g) => ({ ...g, row: clear(g.row), types: g.types.map(clear) })))}
      />
    );
  },
};

export const TwoChannels: Story = { args: { channels: CHANNELS.slice(0, 2) } };

export const NoResetAll: Story = { args: { onResetAll: undefined } };

export const Loading: Story = { args: { groups: [], loading: true } };

export const Empty: Story = { args: { groups: [] } };

export const ResettingAll: Story = { args: { resettingAll: true } };

export const NothingToReset: Story = {
  args: {
    groups: GROUPS.map((g) => ({
      ...g,
      row: { ...g.row, cells: Object.fromEntries(Object.keys(g.row.cells).map((k) => [k, { value: null, effective: false }])) },
      types: [],
    })),
  },
};
