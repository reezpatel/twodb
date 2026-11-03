import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsInstagramSession } from "./settings-instagram-session";
import { SettingsShareTargets, type ShareTargets } from "./settings-share-targets";
import { SettingsSharedDatabases, type SharedDatabase } from "./settings-shared-databases";

const DATABASES: SharedDatabase[] = [
  { id: "d1", title: "Inbox" },
  { id: "d2", title: "Instagram saves" },
  { id: "d3", title: "" },
];

const meta = {
  title: "Blocks/Settings/SharedContent/Page",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole page as composed in the app; everything is wired to local state. */
export const Default: Story = {
  render: () => {
    const [databases, setDatabases] = useState(DATABASES);
    const [saved, setSaved] = useState<ShareTargets>({ default: "d1", instagram: null });
    const [draft, setDraft] = useState(saved);
    const [configured, setConfigured] = useState(true);
    return (
      <>
        <SettingsSharedDatabases
          databases={databases}
          onOpen={() => {}}
          onCreate={(title) => setDatabases((cur) => [...cur, { id: String(Date.now()), title }])}
        />
        <SettingsShareTargets
          databases={databases}
          targets={draft}
          onTargetsChange={setDraft}
          dirty={draft.default !== saved.default || draft.instagram !== saved.instagram}
          onSave={() => setSaved(draft)}
        />
        <SettingsInstagramSession configured={configured} masked="1234…cdef" onSave={(value) => setConfigured(value !== "")} />
      </>
    );
  },
};

export const FirstRun: Story = {
  render: () => (
    <>
      <SettingsSharedDatabases databases={[]} onCreate={() => {}} />
      <SettingsShareTargets databases={[]} targets={{ default: null, instagram: null }} onTargetsChange={() => {}} />
      <SettingsInstagramSession configured={false} onSave={() => {}} />
    </>
  ),
};

export const Loading: Story = { render: () => <SettingsSharedDatabases databases={[]} loading /> };

export const Errors: Story = {
  render: () => (
    <>
      <SettingsSharedDatabases databases={DATABASES} onCreate={() => {}} error="A database with that title already exists." />
      <SettingsShareTargets
        databases={DATABASES}
        targets={{ default: "d1", instagram: "d2" }}
        onTargetsChange={() => {}}
        dirty
        onSave={() => {}}
        error="Couldn't save targets."
      />
      <SettingsInstagramSession configured onSave={() => {}} masked="1234…cdef" error="Instagram rejected that cookie." />
    </>
  ),
};

export const Saving: Story = {
  render: () => (
    <>
      <SettingsSharedDatabases databases={DATABASES} onCreate={() => {}} creating />
      <SettingsShareTargets databases={DATABASES} targets={{ default: "d1", instagram: null }} onTargetsChange={() => {}} dirty saving />
      <SettingsInstagramSession configured={false} onSave={() => {}} saving />
    </>
  ),
};
