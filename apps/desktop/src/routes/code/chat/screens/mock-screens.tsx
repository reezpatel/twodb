import { Code2, GitBranch, History, Terminal, GitCommitHorizontal } from "lucide-react";

export type ScreenId = "code" | "branch" | "terminal" | "checkpoints" | "changes";

export const TOOL_SCREENS: { id: ScreenId; label: string; icon: typeof Code2 }[] = [
  { id: "code", label: "Chat", icon: Code2 },
  { id: "branch", label: "main", icon: GitBranch },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "checkpoints", label: "Checkpoints", icon: History },
  { id: "changes", label: "Changes", icon: GitCommitHorizontal },
];

function MockScreen({ icon: Icon, title, hint }: { icon: typeof Code2; title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <Icon size={28} className="text-muted-foreground/50" aria-hidden="true" />
      <p className="text-muted-foreground text-sm font-medium">{title}</p>
      <p className="text-muted-foreground/70 max-w-xs text-center text-xs">{hint}</p>
    </div>
  );
}

export function BranchScreen() {
  return <MockScreen icon={GitBranch} title="Branches" hint="Branch management lands with the code-session worktree tooling. Mocked for now." />;
}

export function TerminalScreen() {
  return (
    <MockScreen
      icon={Terminal}
      title="Session terminal"
      hint="Interactive terminals per session are coming. Use Settings → Runners for a raw runner terminal today."
    />
  );
}

export function CheckpointsScreen() {
  return <MockScreen icon={History} title="Checkpoints" hint="Snapshot and restore session checkpoints. Mocked for now." />;
}

export function ChangesScreen() {
  return <MockScreen icon={GitCommitHorizontal} title="Changes" hint="Diffs produced by agent edits, ready to commit. Mocked for now." />;
}
