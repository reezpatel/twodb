import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsAdministrator } from "./settings-administrator";

const meta = {
  title: "Blocks/Settings/Administrator/Administrator",
  component: SettingsAdministrator,
  parameters: { layout: "padded" },
  args: { signUpEnabled: true, onSignUpEnabledChange: () => {} },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsAdministrator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [enabled, setEnabled] = useState(args.signUpEnabled);
    return <SettingsAdministrator {...args} signUpEnabled={enabled} onSignUpEnabledChange={setEnabled} />;
  },
};

export const SignUpsClosed: Story = { args: { signUpEnabled: false } };

export const Saving: Story = { args: { saving: true } };

export const Loading: Story = { args: { loading: true } };

export const NotAnAdmin: Story = { args: { error: "Not available — requires an admin account." } };
