import { useEffect, useState, type ComponentProps } from "react";
import { Check, Copy, KeyRound, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/** Hairline inset divider under a row, inset 20px from each side; the last row drops it. */
const DIVIDER = "after:absolute after:right-5 after:bottom-0 after:left-5 after:border-b-[0.5px] after:border-foreground/[0.09] after:content-['']";

export interface SettingsApiKey {
  id: string;
  name: string;
  /** First characters of the key — all that's ever shown again after creation. */
  prefix: string;
  /** Pre-formatted, e.g. "2d ago". */
  createdLabel: string;
  /** Pre-formatted, e.g. "never" or "5m ago". */
  lastUsedLabel: string;
  revoked?: boolean;
}

export interface SettingsApiKeysProps extends Omit<ComponentProps<"section">, "onCopy" | "title"> {
  /** Header title. Default "API keys". */
  title?: string;
  keys: SettingsApiKey[];
  /** First load in flight. */
  loading?: boolean;
  /** Set when the list can't be loaded (e.g. signed out). */
  error?: string | null;
  /** Creates a key from the typed name. Without it the Add button is hidden. */
  onCreate?: (name: string) => void;
  creating?: boolean;
  /** The just-created secret — shown once with a copy button until dismissed. */
  newKey?: string | null;
  onDismissNewKey?: () => void;
  onRevoke?: (id: string) => void;
  revoking?: boolean;
}

/** Keys: list with a hover menu, an inline "add" form and a one-time reveal of a new secret. Controlled — the parent owns the data. */
export function SettingsApiKeys({
  title = "API keys",
  keys,
  loading,
  error,
  onCreate,
  creating,
  newKey,
  onDismissNewKey,
  onRevoke,
  revoking,
  className,
  ...props
}: SettingsApiKeysProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const activeCount = keys.filter((key) => !key.revoked).length;

  // A new secret means the create finished: close the form.
  useEffect(() => {
    if (newKey) {
      setAdding(false);
      setName("");
      setCopied(false);
    }
  }, [newKey]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const submit = () => {
    if (name.trim() && !creating) onCreate?.(name.trim());
  };

  return (
    <section
      data-slot="settings-api-keys"
      className={cn("bg-card text-muted-foreground overflow-hidden rounded-sm font-sans text-sm font-[450] tracking-[-0.05px]", className)}
      {...props}
    >
      <header className={cn("relative flex min-h-14 items-center gap-2 px-5 py-3", DIVIDER)}>
        <KeyRound className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-muted-foreground text-sm leading-5 font-medium">{title}</h3>
        </div>
        <span className="text-muted-foreground/70 ml-auto shrink-0 text-[13px] leading-5 tabular-nums me-3">{activeCount} active</span>
        {onCreate && !adding ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" /> Add
          </Button>
        ) : null}
      </header>

      {adding && onCreate ? (
        <form
          className={cn("relative flex gap-2 px-5 py-3", DIVIDER)}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            className="h-8 flex-1 text-sm"
            placeholder="Key name (e.g. ci-runner)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Key name"
          />
          <Button type="submit" size="sm" disabled={!name.trim() || creating}>
            {creating ? <Loader2 className="animate-spin" /> : null} Generate
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : null}

      {newKey ? (
        <div className={cn("bg-foreground/4 relative flex flex-col gap-2 px-5 py-3", DIVIDER)}>
          <p className="text-muted-foreground text-xs">Copy this key now — it is never shown again.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{newKey}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title={copied ? "Copied" : "Copy"}
              aria-label={copied ? "Copied key" : "Copy key"}
              onClick={() => {
                void navigator.clipboard?.writeText(newKey);
                setCopied(true);
              }}
            >
              {copied ? <Check className="text-emerald-600 dark:text-emerald-500" /> : <Copy />}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismissNewKey}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">{error}</p>
      ) : loading ? (
        <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : keys.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No keys yet{onCreate ? " — add one to get started." : "."}</p>
      ) : (
        <ul>
          {keys.map((key) => (
            <li
              key={key.id}
              className={cn(
                "group relative flex min-h-16 items-center gap-3 px-5 py-3 transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 last:after:hidden",
                DIVIDER,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn("text-foreground min-w-0 truncate font-mono text-[13px]", key.revoked && "text-muted-foreground line-through")}>
                    {key.name}
                  </span>
                  {key.revoked ? <span className="bg-destructive/10 text-destructive rounded-md px-1.5 py-px text-xs leading-5">Revoked</span> : null}
                </div>
                <p className="text-muted-foreground mt-1 truncate font-mono text-[13px]">{key.revoked ? "••••••••••••" : `${key.prefix}…••••••••`}</p>
              </div>
              {onRevoke && !key.revoked ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`More actions for ${key.name}`}
                      className="text-muted-foreground hover:text-foreground rounded-full opacity-0 transition-[opacity,background-color] duration-150 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className="bg-card text-muted-foreground shadow-card min-w-32 rounded-[14px] border-0 p-1 text-sm font-[450] tracking-[-0.05px]"
                  >
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer rounded-[10px] px-3 py-2"
                      disabled={revoking}
                      onClick={() => onRevoke(key.id)}
                    >
                      Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
