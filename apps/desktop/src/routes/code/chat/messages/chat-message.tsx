import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatMessage, CodeChatSkill, CodeChatSkills } from "@/components/blocks/code/code-chat/code-chat-message";

export interface MessageSkill {
  name: string;
  content: string;
}

interface ChatMessageProps {
  role: string;
  content: string;
  resolveAssetUrl?: (uri: string) => string | undefined;
  label?: string;
  skills?: MessageSkill[];
  onSkillClick?: (skill: MessageSkill) => void;
}

const SKILL_BLOCK = /<skill name="[\w.-]+">[\s\S]*?<\/skill>/g;

/** One user or assistant message. Expanded skills render as chips — their content opens in a dialog, never inline. */
export function ChatMessage({ role, content, resolveAssetUrl, label, skills, onSkillClick }: ChatMessageProps) {
  if (role === "user") {
    const text = skills?.length ? content.replace(SKILL_BLOCK, "").trim() : content;
    return (
      <CodeChatMessage variant="user">
        {skills?.length ? (
          <CodeChatSkills>
            {skills.map((skill) => (
              <CodeChatSkill key={skill.name} title="Show skill content" onClick={() => onSkillClick?.(skill)}>
                {skill.name}
              </CodeChatSkill>
            ))}
          </CodeChatSkills>
        ) : null}
        {text && <MessageMarkdown text={text} resolveAssetUrl={resolveAssetUrl} />}
      </CodeChatMessage>
    );
  }
  return (
    <CodeChatMessage>
      {label && <span className="text-muted-foreground text-[13px] font-semibold tracking-wide uppercase">{label}</span>}
      <MessageMarkdown text={content} resolveAssetUrl={resolveAssetUrl} />
    </CodeChatMessage>
  );
}
