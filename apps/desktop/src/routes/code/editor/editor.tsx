import { Code2 } from "lucide-react";

export function Editor() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Code2 size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">Editor</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">The code view lands with the agent file-editing tools. Chat is fully live.</p>
      </div>
    </div>
  );
}
