import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsApiKeys } from "./settings-api-keys";
import { SettingsAppearance, type SettingsTheme } from "./settings-appearance";

/** The General page as composed in the app: appearance, then API keys. */
function GeneralPage() {
  const [theme, setTheme] = useState<SettingsTheme>("system");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <SettingsAppearance theme={theme} onThemeChange={setTheme} installState="promptable" onInstall={() => {}} />
      <SettingsApiKeys
        title="Runner access keys"
        keys={[{ id: "r1", name: "studio-mac", prefix: "twodb_rk_4c1d", createdLabel: "8d ago", lastUsedLabel: "never" }]}
        onCreate={() => {}}
        onRevoke={() => {}}
      />
      <SettingsApiKeys
        keys={[
          { id: "1", name: "ci-runner", prefix: "twodb_a3f2", createdLabel: "12d ago", lastUsedLabel: "5m ago" },
          { id: "2", name: "local-scripts", prefix: "twodb_91bc", createdLabel: "3d ago", lastUsedLabel: "never" },
        ]}
        onCreate={() => {}}
        onRevoke={() => {}}
      />
    </div>
  );
}

const meta = { title: "Blocks/Settings/General/Page", component: GeneralPage, parameters: { layout: "padded" } } satisfies Meta<typeof GeneralPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
