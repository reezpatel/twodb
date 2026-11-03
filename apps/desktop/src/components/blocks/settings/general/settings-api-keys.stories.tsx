import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsApiKeys, type SettingsApiKey } from "./settings-api-keys";

const KEYS: SettingsApiKey[] = [
  { id: "1", name: "ci-runner", prefix: "twodb_a3f2", createdLabel: "12d ago", lastUsedLabel: "5m ago" },
  { id: "2", name: "local-scripts", prefix: "twodb_91bc", createdLabel: "3d ago", lastUsedLabel: "never" },
  { id: "3", name: "old-dashboard", prefix: "twodb_07de", createdLabel: "90d ago", lastUsedLabel: "40d ago", revoked: true },
];

const meta = {
  title: "Blocks/Settings/General/ApiKeys",
  component: SettingsApiKeys,
  parameters: { layout: "padded" },
  args: { keys: KEYS, onCreate: () => {}, onRevoke: () => {} },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsApiKeys>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Full flow: Add → name → Generate reveals the secret once; Revoke strikes a key through. */
export const Interactive: Story = {
  render: (args) => {
    const [keys, setKeys] = useState(args.keys);
    const [newKey, setNewKey] = useState<string | null>(null);
    return (
      <SettingsApiKeys
        keys={keys}
        newKey={newKey}
        onDismissNewKey={() => setNewKey(null)}
        onCreate={(name) => {
          setKeys((cur) => [{ id: String(Date.now()), name, prefix: "twodb_new1", createdLabel: "just now", lastUsedLabel: "never" }, ...cur]);
          setNewKey("twodb_new1_8Hq2Lx9vKd4w9b1cZt7mPq3RsE5nYu6A");
        }}
        onRevoke={(id) => setKeys((cur) => cur.map((k) => (k.id === id ? { ...k, revoked: true } : k)))}
      />
    );
  },
};

export const NewKeyRevealed: Story = { args: { newKey: "twodb_new1_8Hq2Lx9vKd4w9b1cZt7mPq3RsE5nYu6A", onDismissNewKey: () => {} } };

export const Creating: Story = { args: { creating: true } };

export const Empty: Story = { args: { keys: [] } };

export const Loading: Story = { args: { keys: [], loading: true } };

export const SignedOut: Story = { args: { keys: [], error: "Sign in to manage API keys." } };

export const ReadOnly: Story = { args: { onCreate: undefined, onRevoke: undefined } };

/** The same block titled for another kind of key. */
export const CustomTitle: Story = { args: { title: "Runner access keys" } };
