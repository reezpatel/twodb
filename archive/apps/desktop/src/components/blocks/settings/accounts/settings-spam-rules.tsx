import type { ComponentProps } from "react";
import { Ban, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export interface SpamRule {
  id: string;
  matchType: "sender" | "domain" | string;
  value: string;
}

export interface SettingsSpamRulesProps extends ComponentProps<typeof SettingsCard> {
  rules: SpamRule[];
  loading?: boolean;
  onDelete?: (id: string) => void;
}

/** Senders and domains always routed to Spam. Controlled. */
export function SettingsSpamRules({ rules, loading, onDelete, ...props }: SettingsSpamRulesProps) {
  return (
    <SettingsCard data-slot="settings-spam-rules" {...props}>
      <SettingsCardHeader icon={Ban} title="Spam rules">
        <span className="text-muted-foreground/70 text-[13px] tabular-nums">{rules.length} rules</span>
      </SettingsCardHeader>

      <SettingsCardRow divider className="py-3">
        <p className="text-muted-foreground/70 text-xs">Senders and domains you chose to always route to Spam. Applied locally to newly synced mail.</p>
      </SettingsCardRow>

      {loading ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No rules yet — use “Always send to Spam” when marking mail as spam.</p>
      ) : (
        <ul>
          {rules.map((rule) => (
            <li key={rule.id} className={cn("group relative flex min-h-12 items-center gap-3 px-5 py-2 last:after:hidden", SETTINGS_DIVIDER)}>
              <span className="bg-foreground/6 text-muted-foreground rounded-md px-1.5 py-px text-xs leading-5">{rule.matchType}</span>
              <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[13px]">
                {rule.matchType === "domain" ? `@${rule.value}` : rule.value}
              </span>
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete rule ${rule.value}`}
                  onClick={() => onDelete(rule.id)}
                  className="text-muted-foreground hover:text-foreground rounded-full opacity-0 transition-[opacity,background-color] duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
