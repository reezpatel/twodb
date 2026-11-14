import type { MutableRefObject, KeyboardEvent, FormEvent } from "react";
import {
  RichMentionsAutocomplete,
  RichMentionsInput,
  RichMentionsProvider,
  type TMentionConfig,
  type TMentionContext,
} from "react-rich-mentions";
import type { ComposerMention } from "../hooks/useRichMentionComposer";

const RICH_MENTION_STYLES = `
.twochat-rich-editor {
  min-height: 2.5rem;
  max-height: 7.25rem;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklab, var(--color-muted-foreground) 35%, transparent) transparent;
}
.twochat-rich-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--color-muted-foreground);
  pointer-events: none;
}
.twochat-rich-editor[aria-disabled="true"] { pointer-events: none; opacity: .55; }
.twochat-rich-editor:focus { outline: none; }
.twochat-rich-mention {
  display: inline;
  border-radius: .3rem;
  background: color-mix(in oklab, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  padding: .08rem .25rem;
  font-weight: 600;
  white-space: nowrap;
}
.twochat-rich-mention-pending { opacity: .75; }
.autocomplete {
  z-index: 80;
  width: 15rem;
}
.autocomplete-list {
  position: absolute;
  display: flex;
  max-height: 15rem;
  width: 15rem;
  flex-direction: column;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: .65rem;
  background: var(--color-card);
  padding: .3rem;
  color: var(--color-foreground);
  box-shadow: 0 12px 30px rgb(0 0 0 / .18);
}
.autocomplete-item {
  width: 100%;
  border-radius: .45rem;
  padding: .5rem .65rem;
  text-align: left;
  font-size: .8125rem;
}
.autocomplete-item:hover,
.autocomplete-item-selected {
  background: var(--color-muted);
  color: var(--color-foreground);
}
`;

/** Content-editable mention input and keyboard-navigable member suggestions. */
export function RichMentionEditor(props: {
  configs: TMentionConfig<ComposerMention>[];
  contextRef: MutableRefObject<TMentionContext | null>;
  defaultValue?: string;
  disabled?: boolean;
  onInput: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <RichMentionsProvider configs={props.configs} getContext={props.contextRef}>
      <style dangerouslySetInnerHTML={{ __html: RICH_MENTION_STYLES }} />
      <RichMentionsInput
        defaultValue={props.defaultValue ?? ""}
        role="textbox"
        aria-label="Message"
        aria-multiline="true"
        aria-disabled={props.disabled ? "true" : undefined}
        tabIndex={props.disabled ? -1 : 0}
        data-placeholder={props.disabled ? "You're not a member of this conversation" : "Message… (@ to mention)"}
        className="twochat-rich-editor min-w-0 flex-1 bg-transparent px-3 py-2 text-sm leading-5 text-foreground"
        onInput={props.onInput as unknown as (event: FormEvent<HTMLDivElement>) => void}
        onKeyDown={props.onKeyDown}
      />
      <RichMentionsAutocomplete fixed />
    </RichMentionsProvider>
  );
}
