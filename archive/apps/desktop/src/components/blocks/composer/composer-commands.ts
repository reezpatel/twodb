export interface ComposerCommand {
  id: string;
  label: string;
  description: string;
  group: "Skills" | "Commands";
  /** "skill" → the composer inserts a skill chip (content expands on send). */
  kind?: "skill";
  /** Full skill content for kind="skill". */
  content?: string;
}

/** No built-in commands — chats supply their own; skills arrive live from the session. */
export const COMPOSER_COMMANDS: ComposerCommand[] = [];

/** Shared chat commands (code + assistant) — real skills arrive live from the session. */
export const CHAT_COMPOSER_COMMANDS: ComposerCommand[] = [
  { id: "cmd:compact", label: "compact", description: "Summarize older history — keeps recent context", group: "Commands" },
  { id: "cmd:clear", label: "clear", description: "Drop prior context — fresh start without a new session", group: "Commands" },
  { id: "cmd:btw", label: "btw", description: "Side question to another agent — opens a /btw thread", group: "Commands" },
];

export function searchCommands(query: string, commands: ComposerCommand[] = COMPOSER_COMMANDS): ComposerCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
}

export function isSkillCommand(command: ComposerCommand): boolean {
  return command.kind === "skill";
}
