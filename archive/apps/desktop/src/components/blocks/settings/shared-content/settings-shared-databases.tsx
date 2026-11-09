import { useState, type ComponentProps } from "react";
import { Database, Loader2, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export interface SharedDatabase {
  id: string;
  title: string;
}

export interface SettingsSharedDatabasesProps extends Omit<ComponentProps<typeof SettingsCard>, "onSelect"> {
  databases: SharedDatabase[];
  loading?: boolean;
  /** Opens the database in notes. */
  onOpen?: (id: string) => void;
  /** Creates a database from the typed title. Without it the form is hidden. */
  onCreate?: (title: string) => void;
  creating?: boolean;
  /** Create failure, shown under the form. */
  error?: string | null;
}

/** Locked shared-content databases: list (click to open) and a create form. Controlled. */
export function SettingsSharedDatabases({ databases, loading, onOpen, onCreate, creating, error, ...props }: SettingsSharedDatabasesProps) {
  const [title, setTitle] = useState("");

  return (
    <SettingsCard data-slot="settings-shared-databases" {...props}>
      <SettingsCardHeader icon={Database} title="Shared content databases">
        <span className="text-muted-foreground/70 text-[13px] tabular-nums">{databases.length} total</span>
      </SettingsCardHeader>

      <SettingsCardRow divider className="py-3">
        <p className="text-muted-foreground/70 text-xs">
          Links shared to this app are stored as rows in a database. Their schema is <span className="text-foreground font-medium">locked</span> (content, url,
          tags, site, medias, status) — move them around in your notes, but the app manages their columns.
        </p>
      </SettingsCardRow>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : databases.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No shared-content databases yet.</p>
      ) : (
        <ul>
          {databases.map((database) => (
            <li key={database.id} className={cn("relative last:after:hidden", SETTINGS_DIVIDER)}>
              <button
                type="button"
                onClick={() => onOpen?.(database.id)}
                disabled={!onOpen}
                className="hover:bg-foreground/4 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none"
              >
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">{database.title || "Untitled database"}</span>
                <span className="text-muted-foreground/70 flex shrink-0 items-center gap-1 font-mono text-xs">
                  <Lock className="size-3" aria-hidden="true" /> twodb:shared_content
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {onCreate ? (
        <SettingsCardRow className={cn("border-foreground/[0.09] border-t-[0.5px] py-3")}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && !creating) {
                onCreate(title.trim());
                setTitle("");
              }
            }}
          >
            <Input
              className="h-8 flex-1 text-sm"
              placeholder="New database title (e.g. Inbox, Instagram saves)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="New database title"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!title.trim() || creating}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />} Create
            </Button>
          </form>
          {error ? <p className="text-destructive mt-2 text-xs">{error}</p> : null}
        </SettingsCardRow>
      ) : null}
    </SettingsCard>
  );
}
