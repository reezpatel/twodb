import type { ComponentProps, MouseEvent } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

type ComposerEditorProps = Omit<ComponentProps<"div">, "children" | "onClick"> & {
  editor: Editor | null;
  /** Called with the paste id when a "Paste #n: … lines" chip is clicked. */
  onPasteClick?: (pasteId: string) => void;
};

/** Renders a composer editor created by useComposer. All behavior (send, suggestions, chips) lives in the hook. */
export function ComposerEditor({ editor, onPasteClick, className, ...props }: ComposerEditorProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const chip = (event.target as HTMLElement).closest("[data-paste-chip]");
    if (chip) onPasteClick?.(chip.getAttribute("data-paste-id") ?? "");
  };

  return (
    <div data-slot="composer-editor" className={cn("min-h-12", className)} onClick={handleClick} {...props}>
      <EditorContent editor={editor} />
    </div>
  );
}
