import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RichTextEditor, RichTextView } from "@twodb/editor";
import "@twodb/editor/styles.css";

const SAMPLE_HTML = `
  <h2>Release notes</h2>
  <p>The shared editor supports <strong>rich formatting</strong>, links, lists, quotes, code, and task items.</p>
  <ul data-type="taskList">
    <li data-checked="true"><label><input type="checkbox" checked="checked"></label><div><p>Publish the component library</p></div></li>
    <li data-checked="false"><label><input type="checkbox"></label><div><p>Collect feedback from app teams</p></div></li>
  </ul>
  <blockquote><p>Apps own the content; <code>@twodb/editor</code> owns the editing experience.</p></blockquote>
`;

const meta = {
  title: "Editor/RichTextEditor",
  component: RichTextEditor,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    value: SAMPLE_HTML,
    placeholder: "Write something…",
  },
  decorators: [
    (Story) => (
      <div className="w-[min(720px,calc(100vw-3rem))]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledEditor(props: { initialValue?: string; minimal?: boolean; editable?: boolean }) {
  const [value, setValue] = useState(props.initialValue ?? SAMPLE_HTML);
  return (
    <div className="space-y-3">
      <RichTextEditor
        value={value}
        onChange={setValue}
        minimal={props.minimal}
        editable={props.editable}
        placeholder="Write something…"
      />
      {props.editable !== false ? (
        <p className="text-xs text-ink-muted">Controlled HTML value · {value.length} characters</p>
      ) : null}
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledEditor />,
};

export const Empty: Story = {
  render: () => <ControlledEditor initialValue="" />,
};

export const Minimal: Story = {
  render: () => <ControlledEditor minimal />,
};

export const ReadOnly: Story = {
  render: () => (
    <div className="rounded-md border border-outline bg-paper p-5">
      <RichTextView html={SAMPLE_HTML} />
    </div>
  ),
};
