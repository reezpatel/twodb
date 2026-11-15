import { Bot as BotIcon } from "lucide-react";
import type { Bot } from "../../../lib/chat-client";

/** Dropdown of the workspace's collaborators (agents that can work for you). Never takes a typed id. */
export function CollaboratorPicker(props: {
  id: string;
  collaborators: Bot[];
  value: string;
  onChange: (botId: string) => void;
}) {
  const selected = props.collaborators.find((bot) => bot.id === props.value);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {selected?.avatarEmoji ? <span className="text-sm leading-none">{selected.avatarEmoji}</span> : <BotIcon size={14} />}
        </span>
        <select
          id={props.id}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-border bg-background pl-9 pr-8 text-sm text-foreground outline-none focus:border-primary/50"
        >
          {props.collaborators.map((bot) => (
            <option key={bot.id} value={bot.id} disabled={bot.enabled === false}>
              {bot.name}{bot.enabled === false ? " — not set up yet" : ""}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">⌄</span>
      </div>
      {selected?.description ? <span className="text-[11px] text-muted-foreground">{selected.description}</span> : null}
    </div>
  );
}
