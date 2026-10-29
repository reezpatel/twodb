import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsLogs, type LogEntry, type LogLevelFilter, type SettingsLogsProps } from "./settings-logs";

const entry = (
  line: number,
  level: string | null,
  message: string,
  context: string | null = null,
  time = `2025-01-14T09:12:${String(line % 60).padStart(2, "0")}.${100 + line}Z`,
): LogEntry => ({
  key: `0:${line}`,
  line,
  time: level ? time : null,
  level,
  message,
  context,
});

const ENTRIES: LogEntry[] = [
  entry(1, "info", "server listening", "port=3001"),
  entry(2, "info", "runner connected", 'runnerId=r_8f2a name="studio-mac"'),
  entry(3, "info", "request", "method=GET path=/api/code/sessions status=200 ms=12"),
  entry(4, "warn", "slow query", "table=memory ms=842"),
  entry(5, "info", "session started", "sessionId=s_41c0 agent=default"),
  entry(6, "error", "tool failed", 'tool=run_command code=127 stderr="pnpm: command not found"'),
  entry(7, null, "unstructured line from a child process that was not valid JSON"),
  entry(8, "info", "request", "method=POST path=/api/memories status=201 ms=9"),
  entry(9, "warn", "runner heartbeat late", "runnerId=r_8f2a lateMs=4100"),
  entry(10, "error", "provider request failed", "provider=anthropic status=529 retry=2"),
];

const WITH_ROTATION: LogEntry[] = [
  ...ENTRIES.slice(0, 4),
  { key: "1:divider", line: 0, divider: true, time: null, level: null, message: "log file rotated", context: null },
  ...ENTRIES.slice(4).map((e) => ({ ...e, key: `1:${e.line}` })),
];

const LONG: LogEntry[] = Array.from({ length: 200 }, (_, i) =>
  entry(
    i + 1,
    i % 17 === 0 ? "error" : i % 5 === 0 ? "warn" : "info",
    i % 17 === 0 ? "tool failed" : "request",
    `method=GET path=/api/item/${i} ms=${(i * 7) % 90}`,
  ),
);

const meta = {
  title: "Blocks/Settings/Logs",
  component: SettingsLogs,
  parameters: { layout: "padded" },
  args: {
    entries: ENTRIES,
    total: ENTRIES.length,
    file: "server.log",
    error: null,
    loading: false,
    levelFilter: "all",
    follow: true,
    onLevelFilterChange: () => {},
    onFollowChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsLogs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Filter and follow are interactive; the filter narrows the sample entries locally. */
function Interactive(args: SettingsLogsProps) {
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>(args.levelFilter);
  const [follow, setFollow] = useState(args.follow);
  const entries = args.entries.filter((e) => levelFilter === "all" || e.divider || e.level === levelFilter);
  return <SettingsLogs {...args} entries={entries} levelFilter={levelFilter} onLevelFilterChange={setLevelFilter} follow={follow} onFollowChange={setFollow} />;
}

export const Default: Story = { render: (args) => <Interactive {...args} /> };

export const Paused: Story = { args: { follow: false } };

export const Loading: Story = { args: { entries: [], total: 0, file: null, loading: true } };

export const Empty: Story = { args: { entries: [], total: 0 } };

export const EmptyAtLevel: Story = { args: { entries: [], levelFilter: "error" } };

export const WithError: Story = { args: { error: "forbidden — only server admins can read logs" } };

export const Rotated: Story = { args: { entries: WITH_ROTATION, total: WITH_ROTATION.length }, render: (args) => <Interactive {...args} /> };

/** 200 lines — scrolls inside the viewport and stays pinned to the bottom while following. */
export const Long: Story = { args: { entries: LONG, total: LONG.length }, render: (args) => <Interactive {...args} /> };
