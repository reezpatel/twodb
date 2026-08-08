import { useRef, useState, type ReactNode } from "react";
import {
  Download,
  FileText,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  Send,
  SmilePlus,
  MessageSquareReply,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

/* ---------------- Shell ---------------- */

export function ChatPanel({ children }: { children: ReactNode }) {
  return <div className="tw-chat">{children}</div>;
}

export interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  /** Member names for the avatar stack. */
  members?: string[];
  actions?: ReactNode;
}

export function ChatHeader({ title, subtitle, members, actions }: ChatHeaderProps) {
  return (
    <div className="tw-chat__header">
      <div className="tw-chat__title-block">
        <h3 className="tw-chat__title">{title}</h3>
        {subtitle ? <span className="tw-chat__subtitle">{subtitle}</span> : null}
      </div>
      {members ? (
        <div className="tw-chat__members" aria-label={`${members.length} members`}>
          {members.slice(0, 4).map((m) => (
            <Avatar key={m} name={m} size="sm" />
          ))}
          {members.length > 4 ? (
            <span className="tw-chat__members-more tw-tnum">+{members.length - 4}</span>
          ) : null}
        </div>
      ) : null}
      {actions}
    </div>
  );
}

export function ChatList({ children }: { children: ReactNode }) {
  return <div className="tw-chat__list">{children}</div>;
}

/* ---------------- Messages ---------------- */

export interface ChatReaction {
  emoji: string;
  count: number;
  /** Current user already reacted. */
  active?: boolean;
}

export interface ChatAction {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
}

export interface MessageGroupProps {
  author: string;
  avatarSrc?: string;
  /** Marks the sender as a bot — carries the rose light. */
  bot?: boolean;
  time: string;
  children: ReactNode;
}

export function MessageGroup({ author, avatarSrc, bot, time, children }: MessageGroupProps) {
  return (
    <div className="tw-msg-group">
      <div className="tw-msg-group__avatar">
        <Avatar name={author} src={avatarSrc} size="md" />
      </div>
      <div className="tw-msg-group__body">
        <div className="tw-msg-group__head">
          <span className="tw-msg-group__author">{author}</span>
          {bot ? <Badge tone="rose">AI</Badge> : null}
          <span className="tw-msg-group__time tw-tnum">{time}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface ChatMessageProps {
  children: ReactNode;
  reactions?: ChatReaction[];
  /** Bot messages carry action buttons. */
  actions?: ChatAction[];
}

export function ChatMessage({ children, reactions, actions }: ChatMessageProps) {
  const [reacted, setReacted] = useState<number[]>([]);

  return (
    <div className="tw-msg">
      <div className="tw-msg__hover-actions">
        <IconButton size="sm" label="Add reaction" icon={<SmilePlus />} />
        <IconButton size="sm" label="Reply in thread" icon={<MessageSquareReply />} />
        <IconButton size="sm" label="More actions" icon={<MoreHorizontal />} />
      </div>

      <div className="tw-msg__content">{children}</div>

      {reactions && reactions.length > 0 ? (
        <div className="tw-msg__reactions">
          {reactions.map((r, i) => {
            const on = r.active || reacted.includes(i);
            return (
              <button
                key={r.emoji}
                type="button"
                className={on ? "tw-reaction tw-reaction--on" : "tw-reaction"}
                aria-pressed={on}
                onClick={() =>
                  setReacted((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))
                }
              >
                <span className="tw-reaction__emoji">{r.emoji}</span>
                <span className="tw-reaction__count tw-tnum">{r.count + (reacted.includes(i) && !r.active ? 1 : 0)}</span>
              </button>
            );
          })}
          <button type="button" className="tw-reaction tw-reaction--add" aria-label="Add reaction">
            <Plus size={12} />
          </button>
        </div>
      ) : null}

      {actions && actions.length > 0 ? (
        <div className="tw-msg__actions">
          {actions.map((a) => (
            <Button key={a.label} size="sm" variant={a.variant ?? "secondary"} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Content blocks ---------------- */

export function TextMessage({ children }: { children: ReactNode }) {
  return <p className="tw-msg__text">{children}</p>;
}

export function ImageMessage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="tw-msg__image">
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

export function GalleryMessage({ images }: { images: { src: string; alt: string }[] }) {
  return (
    <div className="tw-msg__gallery" data-count={Math.min(images.length, 4)}>
      {images.slice(0, 4).map((img, i) => (
        <div key={i} className="tw-msg__gallery-item">
          <img src={img.src} alt={img.alt} loading="lazy" />
          {i === 3 && images.length > 4 ? (
            <span className="tw-msg__gallery-more tw-tnum">+{images.length - 4}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function VideoMessage({ poster, duration }: { poster: string; duration: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="tw-msg__video">
      <img src={poster} alt="Video attachment" loading="lazy" />
      <button
        type="button"
        className="tw-msg__video-play"
        aria-label={playing ? "Pause video" : "Play video"}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="tw-msg__video-duration tw-tnum">{duration}</span>
    </div>
  );
}

/* deterministic pseudo-waveform */
const WAVE = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.65, 0.4, 0.8, 0.55, 0.95, 0.45, 0.7, 0.3, 0.6, 0.85, 0.5, 0.7, 0.4, 0.62, 0.42, 0.78, 0.55, 0.34];

export function AudioMessage({ duration }: { duration: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="tw-msg__audio">
      <button
        type="button"
        className="tw-msg__audio-play"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        aria-pressed={playing}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className={playing ? "tw-msg__wave tw-msg__wave--playing" : "tw-msg__wave"} aria-hidden="true">
        {WAVE.map((h, i) => (
          <i key={i} style={{ height: `${Math.round(h * 22)}px` }} />
        ))}
      </span>
      <span className="tw-msg__audio-time tw-tnum">{duration}</span>
    </div>
  );
}

export function DocumentMessage({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="tw-msg__doc">
      <span className="tw-msg__doc-icon">
        <FileText size={18} />
      </span>
      <span className="tw-msg__doc-meta">
        <span className="tw-msg__doc-name">{name}</span>
        <span className="tw-msg__doc-sub">{meta}</span>
      </span>
      <IconButton size="sm" variant="secondary" label={`Download ${name}`} icon={<Download />} />
    </div>
  );
}

/* ---------------- Composer ---------------- */

export interface ChatComposerProps {
  placeholder?: string;
  onSend?: (text: string) => void;
}

export function ChatComposer({ placeholder = "Message…", onSend }: ChatComposerProps) {
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function send() {
    const t = text.trim();
    if (!t) return;
    onSend?.(t);
    setText("");
    if (areaRef.current) areaRef.current.style.height = "auto";
  }

  return (
    <div className="tw-composer">
      <div className="tw-composer__box">
        <textarea
          ref={areaRef}
          className="tw-composer__input"
          placeholder={placeholder}
          value={text}
          rows={1}
          aria-label={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            /* grow with content, capped at 3 lines by CSS max-height */
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 77)}px`;
          }}
          onKeyDown={(e) => {
            /* Enter = new line; Ctrl/Cmd+Enter sends */
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="tw-composer__row">
          <IconButton label="Attach a file" icon={<Paperclip />} />
          <IconButton label="Add emoji" icon={<SmilePlus />} />
          <IconButton label="Voice message" icon={<Mic />} />
          <div className="tw-composer__send">
            <span className="tw-composer__hint">Ctrl + Enter to send</span>
            <Button size="sm" onClick={send} disabled={!text.trim()}>
              <Send size={14} aria-hidden="true" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
