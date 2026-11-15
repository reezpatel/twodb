import { useCallback, useMemo, useRef } from "react";
import type { TMentionConfig, TMentionContext, TMentionItem } from "react-rich-mentions";
import type { Member } from "../../../lib/chat-client";

export interface ComposerMention {
  kind: "user" | "bot";
  id: string;
  label: string;
}

export type RichTextElement =
  | { type: "text"; text: string }
  | { type: "mention"; kind: "user" | "bot"; id: string; label: string };

const MENTION_SOURCE = "<@([^|>]+)\\|(user|bot)\\|([^>]+)>";

/**
 * Adapter around react-rich-mentions. Visual chips serialize to stable actor
 * fragments, which are later projected to plain text + a structured block.
 */
export function useRichMentionComposer(members: Member[], onValueChange: (serialized: string) => void) {
  const contextRef = useRef<TMentionContext | null>(null);

  // Identity-stable across websocket refreshes that recreate the members array: the editor memoizes on `configs`,
  // and a new object would make react-rich-mentions re-render and rewrite the editor DOM mid-keystroke.
  const membersKey = useMemo(
    () => members.map((m) => `${m.type}:${m.userId ?? m.botId}`).sort().join(","),
    [members],
  );

  const mentions = useMemo<ComposerMention[]>(() => {
    const seen = new Set<string>();
    const result: ComposerMention[] = [];
    for (const member of members) {
      const id = member.type === "user" ? member.userId : member.botId;
      if (!id) continue;
      const key = `${member.type}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ kind: member.type, id, label: member.name || id });
    }
    return result;
  }, [membersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const configs = useMemo<TMentionConfig<ComposerMention>[]>(() => [
    {
      match: new RegExp(MENTION_SOURCE, "g"),
      matchDisplay: "@$1",
      query: /@([a-zA-Z0-9_.-]*)$/,
      onMention(text: string): TMentionItem<ComposerMention>[] {
        const query = text.slice(1).toLowerCase();
        return mentions
          .filter((mention) => !query || mention.label.toLowerCase().includes(query))
          .slice(0, 12)
          .map((mention) => ({
            ...mention,
            name: mention.label,
            ref: `<@${sanitizeLabel(mention.label)}|${mention.kind}|${mention.id}>`,
          }));
      },
      customizeFragment(fragment: HTMLSpanElement, final: boolean) {
        fragment.className = final
          ? "twochat-rich-mention"
          : "twochat-rich-mention twochat-rich-mention-pending";
      },
    },
  ], [mentions]);

  const readValue = useCallback(() => contextRef.current?.getTransformedValue() ?? "", []);
  const setValue = useCallback((value: string) => contextRef.current?.setValue(value), []);
  const focus = useCallback(() => contextRef.current?.inputElement?.focus(), []);
  const handleInput = useCallback(() => onValueChange(readValue()), [onValueChange, readValue]);

  // Remount the editor only when workspace membership changes; stable otherwise so typing never re-renders it.
  const editorKey = `v1:${membersKey}`;

  return { contextRef, configs, readValue, setValue, focus, handleInput, editorKey };
}

export function parseRichMentionValue(serialized: string): {
  plainText: string;
  mentions: ComposerMention[];
  elements: RichTextElement[];
} {
  const matcher = new RegExp(MENTION_SOURCE, "g");
  const elements: RichTextElement[] = [];
  const mentions: ComposerMention[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(serialized))) {
    if (match.index > cursor) elements.push({ type: "text", text: serialized.slice(cursor, match.index) });
    const mention = { label: match[1], kind: match[2] as "user" | "bot", id: match[3] };
    mentions.push(mention);
    elements.push({ type: "mention", ...mention });
    cursor = match.index + match[0].length;
  }
  if (cursor < serialized.length) elements.push({ type: "text", text: serialized.slice(cursor) });
  return {
    plainText: serialized.replace(new RegExp(MENTION_SOURCE, "g"), "@$1"),
    mentions,
    elements,
  };
}

function sanitizeLabel(label: string): string {
  return label.replace(/[|<>]/g, "").trim() || "unknown";
}
