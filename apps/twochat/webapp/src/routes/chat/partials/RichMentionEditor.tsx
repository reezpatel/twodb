import { memo, useContext, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  RichMentionsAutocomplete,
  RichMentionsProvider,
  RichMentionsContext,
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

/**
 * The editable div itself. Must be a child of RichMentionsProvider so it can take the library context from
 * useContext — the contextRef the parent holds is only populated in the provider's own effect, which runs
 * after child effects on mount, so reading it during mount would race in production builds.
 */
function EditableDiv(props: {
  contextRef: { current: TMentionContext | null };
  defaultValue?: string;
  disabled?: boolean;
  onInput: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const ctx = useContext(RichMentionsContext);
  const divRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest handlers without re-attaching listeners.
  const handlersRef = useRef(props);
  handlersRef.current = props;

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    ctx.setInputElement(div);
    div.innerHTML = ctx.getInitialHTML?.(props.defaultValue ?? "") ?? "";
    const onBeforeInput = (event: Event) => ctx.onBeforeChanges(event as never);
    const onInput = (event: Event) => {
      handlersRef.current.onInput();
      ctx.onChanges(event as never);
    };
    const onKeyDown = (event: Event) => {
      ctx.onKeyDown(event as never);
      handlersRef.current.onKeyDown(event as unknown as KeyboardEvent<HTMLDivElement>);
    };
    div.addEventListener("beforeinput", onBeforeInput);
    div.addEventListener("input", onInput);
    div.addEventListener("keydown", onKeyDown);
    return () => {
      div.removeEventListener("beforeinput", onBeforeInput);
      div.removeEventListener("input", onInput);
      div.removeEventListener("keydown", onKeyDown);
      ctx.setInputElement(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={divRef}
      role="textbox"
      aria-label="Message"
      aria-multiline="true"
      contentEditable={!props.disabled}
      aria-disabled={props.disabled ? "true" : undefined}
      tabIndex={props.disabled ? -1 : 0}
      data-placeholder={props.disabled ? "You're not a member of this conversation" : "Message… (@ to mention)"}
      className="twochat-rich-editor min-w-0 flex-1 bg-transparent px-3 py-2 text-sm leading-5 text-foreground"
    />
  );
}

/**
 * Content-editable mention input and keyboard-navigable member suggestions.
 *
 * Replaces the library's <RichMentionsInput> with our own div wired straight to its context. That component
 * re-applies dangerouslySetInnerHTML on every render (a fresh {__html} object, so React always treats it as
 * changed): with React 19 every provider re-render — autocomplete opening, results loading — rewrote the editor
 * DOM, destroying the pending "@" fragment and the caret mid-keystroke. Here the editable content lives only in
 * the DOM; React never manages this div's children, so no render can wipe it.
 */
export const RichMentionEditor = memo(function RichMentionEditor(props: {
  configs: TMentionConfig<ComposerMention>[];
  contextRef: { current: TMentionContext | null };
  defaultValue?: string;
  disabled?: boolean;
  onInput: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <RichMentionsProvider configs={props.configs} getContext={props.contextRef}>
      <style dangerouslySetInnerHTML={{ __html: RICH_MENTION_STYLES }} />
      <EditableDiv
        contextRef={props.contextRef}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        onInput={props.onInput}
        onKeyDown={props.onKeyDown}
      />
      <RichMentionsAutocomplete fixed />
    </RichMentionsProvider>
  );
}, (prev, next) => prev.configs === next.configs && prev.disabled === next.disabled);
