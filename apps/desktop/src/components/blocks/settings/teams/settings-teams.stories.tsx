import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsTeams, type TeamsAccountItem, type TeamsRunnerOption } from "./settings-teams";

const RUNNERS: TeamsRunnerOption[] = [
  { id: "r1", name: "studio-mac", online: true },
  { id: "r2", name: "build-box", online: true },
  { id: "r3", name: "old-laptop", online: false },
];

const ACCOUNTS: TeamsAccountItem[] = [
  {
    id: "t1",
    label: "Acme Corp",
    status: "running",
    enabled: true,
    runnerName: "studio-mac",
    runnerOnline: true,
    email: "ava@acme.com",
    lastEventLabel: "5/14/2025, 9:12 AM",
  },
  { id: "t2", label: "Globex", status: "auth_required", enabled: true, runnerName: "build-box", runnerOnline: true, email: "ava@globex.io" },
  {
    id: "t3",
    label: "Initech",
    status: "error",
    enabled: true,
    runnerName: "build-box",
    runnerOnline: true,
    lastError: "Chromium exited unexpectedly (code 137).",
  },
  { id: "t4", label: "Umbrella", status: "starting", enabled: true, runnerName: "studio-mac", runnerOnline: true },
  { id: "t5", label: "Hooli", status: "runner_offline", enabled: false, runnerName: "old-laptop", runnerOnline: false },
];

const handlers = { onCreate: () => {}, onToggleEnabled: () => {}, onConnect: () => {}, onStart: () => {}, onStop: () => {}, onRemove: () => {} };

const meta = {
  title: "Blocks/Settings/Teams/Teams",
  component: SettingsTeams,
  parameters: { layout: "padded" },
  args: { accounts: ACCOUNTS, runners: RUNNERS, ...handlers },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsTeams>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Add, enable / disable, start / stop and remove all act on local state. */
export const Interactive: Story = {
  render: (args) => {
    const [accounts, setAccounts] = useState(args.accounts);
    const patch = (id: string, change: Partial<TeamsAccountItem>) => setAccounts((cur) => cur.map((a) => (a.id === id ? { ...a, ...change } : a)));
    return (
      <SettingsTeams
        {...args}
        accounts={accounts}
        onCreate={(input) =>
          setAccounts((cur) => [
            ...cur,
            {
              id: String(Date.now()),
              label: input.label,
              status: "idle",
              enabled: true,
              runnerName: RUNNERS.find((r) => r.id === input.runnerId)?.name ?? "runner",
              runnerOnline: true,
              email: input.email,
            },
          ])
        }
        onToggleEnabled={(id, enabled) => patch(id, { enabled })}
        onStart={(id) => patch(id, { enabled: true, status: "starting" })}
        onStop={(id) => patch(id, { enabled: false, status: "idle" })}
        onRemove={(id) => setAccounts((cur) => cur.filter((a) => a.id !== id))}
      />
    );
  },
};

export const Empty: Story = { args: { accounts: [] } };

export const Loading: Story = { args: { accounts: [], loading: true } };

export const CreateError: Story = { args: { createError: "Failed to add the account — is the runner valid?" } };
