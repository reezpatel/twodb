import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsCode, type SkillSources, type TerminalScope } from "./settings-code";

const DEFAULT_PROMPT = `You are a careful coding agent working inside the user's repository.

- Read before you edit; prefer small, reviewable changes.
- Run the project's checks before declaring a task done.
- Ask when a request is ambiguous instead of guessing.`;

const meta = {
  title: "Blocks/Settings/Code/Code",
  component: SettingsCode,
  parameters: { layout: "padded" },
  args: {
    terminalScope: "directory",
    onTerminalScopeChange: () => {},
    skillSources: { agents: true, claude: false },
    onSkillSourcesChange: () => {},
    systemPrompt: DEFAULT_PROMPT,
    onSystemPromptChange: () => {},
    systemPromptIsDefault: true,
    systemPromptDirty: false,
    onSystemPromptSave: () => {},
    onSystemPromptReset: () => {},
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Everything wired to local state: pick a scope, flip the skill folders, edit and save / reset the prompt. */
export const Interactive: Story = {
  render: (args) => {
    const [scope, setScope] = useState<TerminalScope>("directory");
    const [sources, setSources] = useState<SkillSources>({ agents: true, claude: false });
    const [saved, setSaved] = useState<string | null>(null); // null = shipped default
    const [draft, setDraft] = useState<string | null>(null);
    const effective = draft ?? saved ?? DEFAULT_PROMPT;
    const dirty = draft !== null && draft !== (saved ?? DEFAULT_PROMPT);
    return (
      <SettingsCode
        {...args}
        terminalScope={scope}
        onTerminalScopeChange={setScope}
        skillSources={sources}
        onSkillSourcesChange={setSources}
        systemPrompt={effective}
        onSystemPromptChange={setDraft}
        systemPromptIsDefault={saved === null}
        systemPromptDirty={dirty}
        onSystemPromptSave={() => {
          setSaved(draft);
          setDraft(null);
        }}
        onSystemPromptReset={() => {
          setSaved(null);
          setDraft(null);
        }}
      />
    );
  },
};

export const CustomizedPrompt: Story = { args: { systemPromptIsDefault: false, systemPrompt: `${DEFAULT_PROMPT}\n- Always answer in German.` } };

export const UnsavedChanges: Story = { args: { systemPromptDirty: true, systemPrompt: `${DEFAULT_PROMPT}\n- (edited)` } };

export const Saving: Story = { args: { saving: true, systemPromptDirty: true } };

export const Loading: Story = { args: { loading: true, terminalScope: undefined, skillSources: undefined, systemPrompt: "" } };
