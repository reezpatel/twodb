import type { Meta, StoryObj } from "@storybook/react-vite";
import { Orb, VARIANTS, type OrbLook, type OrbState } from "./thinking-orbs";

const meta = {
  title: "UI/ThinkingOrbs",
  component: Orb,
  parameters: { layout: "centered" },
  args: { state: "reasoning", size: 20 },
} satisfies Meta<typeof Orb>;

export default meta;
type Story = StoryObj<typeof meta>;

const LINES: (OrbLook & { label: string })[] = [
  { state: "working", label: "Working" },
  { state: "reasoning", label: "Thinking" },
  { state: "searching", label: "Searching web" },
  { state: "background", label: "2 Background Tasks" },
  { state: "compacting", label: "Compacting context" },
  { state: "retrying", label: "Retrying — attempt 2 of 10" },
  { state: "waiting", label: "Waiting for usage limit to reset" },
];

export const Playground: Story = {};

export const AgentStates: Story = {
  render: () => (
    <div className="text-foreground flex flex-col gap-3 p-6 text-sm">
      {LINES.map(({ label, ...look }) => (
        <div key={look.state} className="flex items-center gap-2">
          <Orb {...look} />
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="text-foreground grid grid-cols-[8rem_repeat(3,5rem)] items-center gap-x-4 gap-y-3 p-6 text-sm">
      {(Object.keys(VARIANTS) as OrbState[]).map((state) => (
        <div key={state} className="contents">
          <span className="text-muted-foreground">{state}</span>
          {VARIANTS[state].map((variant) => (
            <div key={variant} className="flex items-center gap-2">
              <Orb {...({ state, variant } as OrbLook)} size={28} />
              <span className="text-muted-foreground text-xs">{variant}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="text-primary flex items-end gap-4 p-6">
      {[16, 20, 28, 40, 64].map((size) => (
        <Orb key={size} state="reasoning" size={size} />
      ))}
    </div>
  ),
};

export const Paused: Story = { args: { paused: true } };

export const Tinted: Story = {
  render: () => (
    <div className="flex gap-4 p-6">
      <Orb state="retrying" size={24} className="text-warning" />
      <Orb state="reasoning" size={24} className="text-primary" />
      <Orb state="compacting" size={24} className="text-info" />
      <Orb state="working" size={24} className="text-success" />
    </div>
  ),
};
