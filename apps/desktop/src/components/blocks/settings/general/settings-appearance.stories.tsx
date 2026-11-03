import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsAppearance, type SettingsTheme } from "./settings-appearance";

const meta = {
  title: "Blocks/Settings/General/Appearance",
  component: SettingsAppearance,
  parameters: { layout: "padded" },
  args: { theme: "system", onThemeChange: () => {} },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsAppearance>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [theme, setTheme] = useState<SettingsTheme>(args.theme);
    return <SettingsAppearance theme={theme} onThemeChange={setTheme} />;
  },
};

export const Dark: Story = { args: { theme: "dark" } };

export const InstallPromptable: Story = { args: { installState: "promptable", onInstall: () => {} } };

export const InstallUnsupported: Story = { args: { installState: "unsupported" } };

export const InstallStandalone: Story = { args: { installState: "standalone" } };
