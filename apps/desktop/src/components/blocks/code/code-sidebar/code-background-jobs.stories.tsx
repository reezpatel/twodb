import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CodeBackgroundJobs, type CodeBackgroundJob } from "./code-background-jobs";

const JOBS: CodeBackgroundJob[] = [
  { id: "1", command: "pnpm dev --filter desktop", status: "running", detail: "3f9a1c2e · running" },
  { id: "2", command: "pnpm test --watch", status: "running", detail: "81b0d7aa · running" },
  { id: "3", command: "pnpm build", status: "done", detail: "c2e4f610 · done · exit 0" },
  { id: "4", command: "docker compose up postgres && psql -c 'select 1'", status: "failed", detail: "9d11be03 · failed · exit 1" },
  { id: "5", command: "tail -f logs/server.log", status: "stopped", detail: "7a52ce18 · killed" },
];

const LOGS =
  "$ pnpm build\n\n> desktop@0.2.47 build\n> vite build\n\nvite v6 building for production…\n✓ 1423 modules transformed.\ndist/index.html  0.46 kB\n✓ built in 8.12s";

const meta = {
  title: "Blocks/Code/CodeSidebar/BackgroundJobs",
  component: CodeBackgroundJobs,
  parameters: { layout: "centered" },
  args: { jobs: JOBS, onStop: () => {} },
  decorators: [
    (Story) => (
      <div className="bg-background w-72 rounded-md border p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeBackgroundJobs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Click a row to expand its logs. */
export const WithLogs: Story = {
  args: { renderLogs: () => <pre className="text-muted-foreground max-h-64 overflow-auto px-2 py-1.5 font-mono text-[10px] whitespace-pre-wrap">{LOGS}</pre> },
};

/** Stop shows a spinner while the request is in flight and the job drops out once stopped. */
export const Stopping: Story = {
  render: (args) => {
    const [jobs, setJobs] = useState(args.jobs);
    return (
      <CodeBackgroundJobs
        jobs={jobs}
        onStop={(id) => {
          setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, stopping: true } : j)));
          setTimeout(() => setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, status: "stopped", stopping: false, detail: "killed" } : j))), 1200);
        }}
      />
    );
  },
};

export const FinishedOnly: Story = { args: { jobs: JOBS.slice(2), onStop: undefined } };

export const Single: Story = { args: { jobs: JOBS.slice(0, 1) } };

/** Past four rows the list scrolls; running first, then failed, done, stopped. */
export const Many: Story = {
  args: {
    jobs: Array.from({ length: 9 }, (_, i) => {
      const status = (["stopped", "done", "running", "failed", "stopped", "running", "done", "failed", "running"] as const)[i];
      return { id: String(i), command: `pnpm task:${i + 1}`, status, detail: `${String(i).repeat(8)} · ${status}` };
    }),
  },
};
