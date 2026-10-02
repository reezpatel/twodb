export interface ComposerCommand {
  id: string;
  label: string;
  description: string;
  group: "Skills" | "Commands";
}

/** Mock list until skills land server-side. */
export const COMPOSER_COMMANDS: ComposerCommand[] = [
  { id: "cmd:review", label: "review", description: "Review the working tree diff", group: "Commands" },
  { id: "cmd:checkpoint", label: "checkpoint", description: "Capture a checkpoint now", group: "Commands" },
  { id: "cmd:tests", label: "tests", description: "Run the test suite", group: "Commands" },
  { id: "skill:refactor", label: "refactor", description: "Plan and apply a safe refactor", group: "Skills" },
  { id: "skill:explain", label: "explain", description: "Walk through the current file", group: "Skills" },
  { id: "skill:commit", label: "commit", description: "Stage and commit pending changes", group: "Skills" },
];

export function searchCommands(query: string): ComposerCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMPOSER_COMMANDS;
  return COMPOSER_COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
}
