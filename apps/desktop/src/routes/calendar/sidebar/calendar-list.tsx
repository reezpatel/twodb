import { AlertTriangle, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarItem, CalendarMeta } from "../calendar-api";

interface CalendarListProps {
  calendars: CalendarItem[];
  accounts: CalendarMeta["accounts"];
  onToggle: (id: string, hidden: boolean) => void;
}

/** Calendars grouped by account (twodb calendars first); the checkbox is a per-user overlay. */
export function CalendarList({ calendars, accounts, onToggle }: CalendarListProps) {
  const groups = new Map<string, CalendarItem[]>();
  for (const c of calendars) {
    if (!c.syncEnabled && c.accountId) continue;
    const key = c.accountId ?? "twodb";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([key, list]) => {
        const account = accounts.find((a) => a.id === key);
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-muted-foreground/70 flex items-center gap-1.5 truncate px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
              <span className="truncate">{key === "twodb" ? "twodb" : (list[0].accountAddress ?? "Account")}</span>
              {account?.calendarImportState === "running" ? <Loader2 size={10} className="animate-spin" /> : null}
              {account && (account.calendarState === "error" || account.calendarState === "reauth_required") ? (
                <AlertTriangle size={10} className="text-destructive" aria-label={account.calendarError ?? "Sync problem"} />
              ) : null}
            </span>
            {list.map((c) => (
              <label key={c.id} className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm">
                <Checkbox
                  checked={!c.hidden}
                  onCheckedChange={(v) => onToggle(c.id, v !== true)}
                  style={{ borderColor: c.color, backgroundColor: c.hidden ? undefined : c.color }}
                  aria-label={`Show ${c.name}`}
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.role === "viewer" || c.role === "free_busy" || c.kind === "subscription" ? (
                  <span className="text-muted-foreground text-[10px]">read-only</span>
                ) : null}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
