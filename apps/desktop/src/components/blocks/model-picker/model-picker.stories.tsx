import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { MODELS, ModelPickerPlayground } from "./model-picker.fixtures";

const meta = {
  title: "Blocks/ModelPicker/ModelPicker",
  component: ModelPickerPlayground,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ModelPickerPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: ReactNode }) {
  return <div className="flex h-[32rem] items-end p-8">{children}</div>;
}

export const Default: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground defaultOpen />
    </Frame>
  ),
};

export const Editing: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground defaultOpen defaultEditingId={MODELS[0].id} />
    </Frame>
  ),
};

export const NoFavorites: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground defaultOpen initialFavorites={[]} initialSelectedId={null} />
    </Frame>
  ),
};

export const Browser: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground defaultBrowserOpen />
    </Frame>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground disabled />
    </Frame>
  ),
};

export const CustomTrigger: Story = {
  render: () => (
    <Frame>
      <ModelPickerPlayground defaultOpen>
        <div role="button" tabIndex={0} className="bg-primary text-primary-foreground cursor-pointer rounded-full px-4 py-2 text-sm font-medium">
          Choose a model
        </div>
      </ModelPickerPlayground>
    </Frame>
  ),
};

function EventLogPreview() {
  const [events, setEvents] = useState<string[]>([]);
  return (
    <div className="flex h-[32rem] w-[40rem] flex-col justify-between p-8">
      <ul className="text-muted-foreground flex max-h-48 flex-col gap-1 overflow-y-auto font-mono text-xs">
        {events.length === 0 ? <li>Pick a model, star one in the browser, or edit settings — callbacks log here.</li> : null}
        {events.map((event, index) => (
          <li key={index}>{event}</li>
        ))}
      </ul>
      <div>
        <ModelPickerPlayground onEvent={(message) => setEvents((current) => [message, ...current].slice(0, 20))} />
      </div>
    </div>
  );
}

export const CallbackLog: Story = {
  render: () => <EventLogPreview />,
};
