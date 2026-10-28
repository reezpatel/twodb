import { Kbd, KbdGroup } from "@/components/ui/kbd";

type CodeHeaderShortcutProps = {
  keys: string[];
};

export function CodeHeaderShortcut({ keys }: CodeHeaderShortcutProps) {
  return (
    <KbdGroup data-slot="code-header-shortcut">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}
