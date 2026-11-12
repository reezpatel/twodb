import { Button } from "@twodb/blocks";
import { chatApi } from "../../../lib/chat-client";

/**
 * Renders composed message blocks (the dynamic bot-message building blocks —
 * markdown, images, button rows, fields, code, task lists, callouts, link
 * cards, quotes, attachments…). Dumb/presentational: no data fetching, just
 * props-in/JSX-out. Block shapes live backend-side in src/blocks.ts; this
 * mirrors them structurally.
 */

export interface BlockViewProps {
  block: {
    type: string;
    [key: string]: unknown;
  };
  /** Client-side mention resolver (name lookup for user/bot/channel). */
  resolveMention?: (kind: string, id: string) => string | null;
  /** Invokes a bot-authored interactive button. */
  onAction?: (actionId: string, value?: string) => void;
}

export function BlockView(props: BlockViewProps) {
  const { block } = props;
  switch (block.type) {
    case "markdown":
      return <p className="text-sm leading-relaxed whitespace-pre-wrap">{String(block.text)}</p>;
    case "divider":
      return <hr className="my-2 border-border" />;
    case "image":
      return (
        <figure className="max-w-sm overflow-hidden rounded-lg border border-border">
          <img
            src={typeof block.url === "string" && block.url.startsWith("asset:") ? chatApi.assetUrl(block.url.slice(6)) : String(block.url)}
            alt={typeof block.alt === "string" ? block.alt : ""}
            className="block w-full"
            loading="lazy"
          />
          {typeof block.title === "string" ? <figcaption className="px-2 py-1 text-xs text-muted-foreground">{block.title}</figcaption> : null}
        </figure>
      );
    case "actions":
      return (
        <div className="flex flex-wrap gap-2">
          {(Array.isArray(block.elements) ? block.elements : []).map((el, i) => (
            <ActionMessageButton key={i} button={el as Record<string, unknown>} onAction={props.onAction} />
          ))}
        </div>
      );
    case "link-button": {
      const tone = (block.style as { tone?: string } | undefined)?.tone ?? "default";
      return (
        <Button
          size="sm"
          variant={tone === "primary" ? "primary" : "secondary"}
          onClick={() => typeof block.url === "string" && window.open(block.url, "_blank", "noopener")}
        >
          {String(block.text)}
        </Button>
      );
    }
    case "field": {
      const short = block.short === true;
      return (
        <div className={short ? "inline-flex min-w-40 flex-col gap-0.5 pr-4" : "flex flex-col gap-0.5"}>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{String(block.label)}</span>
          <span className="text-sm">{String(block.value)}</span>
        </div>
      );
    }
    case "context":
      return (
        <p className="text-xs text-muted-foreground">
          {(Array.isArray(block.elements) ? block.elements : []).map((el, i) => {
            const mention = (el as { mention?: { kind: string; id: string; label?: string } }).mention;
            if (mention) {
              const label = props.resolveMention?.(mention.kind, mention.id) ?? mention.label ?? mention.id;
              return (
                <span key={i} className="font-medium text-primary">
                  @{label}
                </span>
              );
            }
            return <span key={i}>{String((el as { text?: string }).text ?? "")}</span>;
          })}
        </p>
      );
    case "attachment":
      return (
        <a
          href={chatApi.assetUrl(String(block.assetId))}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:border-primary/40"
        >
          📎 {String(block.filename)}
        </a>
      );
    case "link-card":
      return (
        <a
          href={String(block.url)}
          target="_blank"
          rel="noopener"
          className="flex max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-sm text-primary">🔗</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{typeof block.title === "string" ? block.title : String(block.url)}</span>
            {typeof block.description === "string" ? <span className="truncate text-xs text-muted-foreground">{block.description}</span> : null}
            <span className="truncate text-xs text-muted-foreground">{String(block.url)}</span>
          </span>
        </a>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
          {String(block.text)}
          {typeof block.cite === "string" ? <cite className="mt-0.5 block text-xs not-italic">— {block.cite}</cite> : null}
        </blockquote>
      );
    case "status": {
      const tone = String(block.state);
      const toneClass =
        tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
          : tone === "warning"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
            : tone === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-600"
              : tone === "loading"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground";
      return (
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${toneClass}`}>
          {tone === "loading" ? <span className="animate-spin">◌</span> : tone === "success" ? "✓" : tone === "error" ? "✕" : "ℹ"}
          {String(block.text)}
        </div>
      );
    }
    case "code":
      return (
        <div className="w-full overflow-hidden rounded-lg border border-border">
          {typeof block.filename === "string" ? (
            <div className="border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{String(block.filename)}</div>
          ) : null}
          <pre className="overflow-x-auto bg-muted/40 p-3 text-xs leading-relaxed">
            <code>{String(block.code)}</code>
          </pre>
        </div>
      );
    case "task-list": {
      const title = typeof block.title === "string" ? block.title : null;
      const tasks = Array.isArray(block.tasks) ? (block.tasks as { text: string; done: boolean }[]) : [];
      return (
        <div className="flex flex-col gap-1">
          {title ? <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span> : null}
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className={t.done ? "text-emerald-600" : "text-muted-foreground"}>{t.done ? "☑" : "☐"}</span>
              <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.text}</span>
            </div>
          ))}
        </div>
      );
    }
    case "callout": {
      const tone = String(block.tone ?? "info");
      const toneClass =
        tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/5"
          : tone === "warning"
            ? "border-amber-500/40 bg-amber-500/5"
            : tone === "danger"
              ? "border-red-500/40 bg-red-500/5"
              : "border-primary/40 bg-primary/5";
      return (
        <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
          {typeof block.title === "string" ? <div className="text-sm font-semibold">{block.title}</div> : null}
          <div className="text-sm leading-relaxed">{String(block.text)}</div>
        </div>
      );
    }
    default:
      return null;
  }
}

function ActionMessageButton(props: { button: Record<string, unknown>; onAction?: (actionId: string, value?: string) => void }) {
  const { button } = props;
  const disabled = (button.style as { disabled?: boolean } | undefined)?.disabled === true;
  const tone = (button.style as { tone?: string } | undefined)?.tone ?? "default";
  return (
    <Button
      size="sm"
      variant={tone === "primary" ? "primary" : tone === "danger" ? "danger" : "secondary"}
      disabled={disabled || !props.onAction}
      onClick={() => props.onAction?.(String(button.actionId), typeof button.value === "string" ? button.value : undefined)}
    >
      {String(button.text)}
    </Button>
  );
}
