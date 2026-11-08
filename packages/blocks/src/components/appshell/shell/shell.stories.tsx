import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent } from "./shell";

const meta = {
  title: "Blocks/AppShell/Shell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell style={{ height: 480 }}>
      <AppShellBody>
        <div className="w-14 shrink-0 border-r border-outline bg-stone" />
        <AppShellMain>
          <AppShellHeader>Fusion reactor</AppShellHeader>
          <AppShellContent className="p-4">
            <p>The header lives inside `AppShellMain`, so side nav (the bar on the left here) stretches the full height.</p>
          </AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  ),
};
