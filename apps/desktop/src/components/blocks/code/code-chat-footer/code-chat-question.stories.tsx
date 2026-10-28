import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CodeChatFooter } from "./code-chat-footer";
import { CodeChatQuestionAction, CodeChatQuestionError } from "./code-chat-question";
import { MOCK_QUESTIONS, MockQuestionWizard } from "./code-chat-question.fixtures";

const meta = {
  title: "Blocks/Code/CodeChatFooter/Question",
  component: MockQuestionWizard,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MockQuestionWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">
      <div className="flex-1" />
      <CodeChatFooter>{children}</CodeChatFooter>
    </div>
  );
}

export const SingleChoice: Story = {
  render: () => (
    <Frame>
      <MockQuestionWizard />
    </Frame>
  ),
};

export const MultipleChoice: Story = {
  render: () => (
    <Frame>
      <MockQuestionWizard initialStep={1} />
    </Frame>
  ),
};

export const FreeText: Story = {
  render: () => (
    <Frame>
      <MockQuestionWizard initialStep={2} />
    </Frame>
  ),
};

export const Review: Story = {
  render: () => (
    <Frame>
      <MockQuestionWizard initialStep={MOCK_QUESTIONS.length} />
    </Frame>
  ),
};

export const NoReadableQuestion: Story = {
  render: () => (
    <Frame>
      <MockQuestionWizard questions={[]} />
    </Frame>
  ),
};

export const CouldNotDisplay: Story = {
  render: () => (
    <Frame>
      <CodeChatQuestionError title="The agent's question couldn't be displayed." message="Cannot read properties of undefined (reading 'map')">
        <Button variant="ghost" size="sm">
          Retry
        </Button>
        <CodeChatQuestionAction kind="stop" label="Stop" title="Stop the run without answering" />
      </CodeChatQuestionError>
    </Frame>
  ),
};

function SubmitLogPreview() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">
      <ul className="text-muted-foreground flex-1 overflow-y-auto p-6 font-mono text-xs">
        {log.length === 0 ? <li>Answer the questions — submit and stop are logged here.</li> : null}
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
      <CodeChatFooter>
        <MockQuestionWizard
          onSubmit={(answers) => setLog((current) => [...current, `submitted ${JSON.stringify(answers)}`])}
          onStop={() => setLog((current) => [...current, "stopped"])}
        />
      </CodeChatFooter>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <SubmitLogPreview />,
};
