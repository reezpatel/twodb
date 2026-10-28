import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComposerEditor } from "./composer-editor";
import { useComposer } from "./use-composer";
import type { PasteRef } from "./paste-chip";
import { MOCK_COMMANDS, MOCK_FILES } from "./composer.fixtures";

const meta = {
  title: "Blocks/Composer/ComposerEditor",
  component: ComposerEditor,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ComposerEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

type PlaygroundProps = {
  files?: string[] | null;
  disabled?: boolean;
  placeholder?: string;
};

type Sent = { content: string; skills: string[] };

function Playground({ files = MOCK_FILES, disabled = false, placeholder = "Ask the agent… — @ files, / commands" }: PlaygroundProps) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<Sent[]>([]);
  const [viewPaste, setViewPaste] = useState<PasteRef | null>(null);
  const [viewSkill, setViewSkill] = useState<{ name: string; content: string } | null>(null);

  const { editor, submit, pastes } = useComposer({
    files,
    commands: MOCK_COMMANDS,
    disabled,
    placeholder,
    onDraft: setDraft,
    onSkillClick: setViewSkill,
    onSend: (content, skills) => {
      setSent((current) => [...current, { content, skills: skills.map((skill) => skill.name) }]);
      return true;
    },
  });

  return (
    <div className="flex w-[40rem] flex-col gap-4 px-6 pt-96 pb-6">
      <div className="bg-muted/60 flex flex-col rounded-2xl border p-2 shadow-sm">
        <ComposerEditor editor={editor} onPasteClick={(id) => setViewPaste(pastes.current.get(id) ?? null)} />
        <div className="flex items-center gap-2 pt-2">
          <span className="text-muted-foreground text-xs">
            Enter sends · Shift+Enter for a new line · paste 3+ lines for a chip · try `code`, **bold**, *italic*, ~~strike~~
          </span>
          <Button size="icon-sm" className="ml-auto size-8 rounded-full" aria-label="Send" disabled={!draft.trim() || disabled} onClick={submit}>
            <ArrowUp />
          </Button>
        </div>
      </div>

      <ul className="text-muted-foreground flex flex-col gap-2 font-mono text-xs">
        {sent.length === 0 ? <li>Sent messages appear here, with chips expanded as the agent would receive them.</li> : null}
        {sent.map((message, index) => (
          <li key={index} className="bg-card rounded-md border p-2 whitespace-pre-wrap">
            {message.skills.length > 0 ? (
              <span className="text-primary">
                skills: {message.skills.join(", ")}
                {"\n"}
              </span>
            ) : null}
            {message.content}
          </li>
        ))}
      </ul>

      <Dialog open={!!viewPaste} onOpenChange={(open) => !open && setViewPaste(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Paste #{viewPaste?.id} — {viewPaste?.lines} lines
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-muted max-h-[60vh] overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">{viewPaste?.content}</pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSkill} onOpenChange={(open) => !open && setViewSkill(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>/{viewSkill?.name}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted max-h-[60vh] overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">{viewSkill?.content}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Default: Story = {
  args: { editor: null },
  render: () => <Playground />,
};

export const NoFileMentions: Story = {
  args: { editor: null },
  render: () => <Playground files={null} placeholder="Ask the assistant… — / commands" />,
};

export const Disabled: Story = {
  args: { editor: null },
  render: () => <Playground disabled placeholder="Add an LLM connection in Settings → LLM first" />,
};
