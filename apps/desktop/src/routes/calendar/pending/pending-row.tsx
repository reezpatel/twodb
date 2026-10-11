import { ArrowRight, Check, CloudOff, Mail, TriangleAlert, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatRange, type PendingChange } from "../calendar-api";

const OP_LABEL: Record<PendingChange["op"], string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  move: "Move",
  rsvp: "RSVP",
  cancel_instance: "Cancel occurrence",
};
const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  descriptionHtml: "Description",
  location: "Location",
  time: "Time",
  rrule: "Repeat",
  status: "Status",
  transparency: "Show as",
  visibility: "Visibility",
  eventType: "Type",
  color: "Color",
  conference: "Video call",
  attendees: "Guests",
  reminders: "Reminders",
  guestPermissions: "Guest permissions",
};
const SCOPE_LABEL = { this: "this occurrence", following: "this and following", all: "all events in series" };

interface TimeValue {
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
}

function plain(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Human-readable value of one snapshot field. */
function show(field: string, value: unknown, tz: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "time") return formatRange(value as TimeValue, tz);
  if (field === "descriptionHtml") return plain(String(value)).slice(0, 80) || "—";
  if (field === "conference")
    return (
      (value as { url?: string; create?: boolean; type?: string }).url ??
      ((value as { create?: boolean }).create ? `new ${(value as { type?: string }).type === "teams" ? "Teams" : "Meet"} link` : "—")
    );
  if (field === "reminders") return (value as { minutes: number }[]).map((r) => `${r.minutes}m`).join(", ") || "none";
  if (field === "rrule")
    return (
      ((value as string[]) ?? [])
        .filter((l) => l.startsWith("RRULE"))
        .map((l) => l.replace("RRULE:", ""))
        .join(" ") || "Does not repeat"
    );
  if (field === "guestPermissions")
    return (
      Object.entries(value as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ") || "none"
    );
  if (field === "transparency") return value === "transparent" ? "Free" : "Busy";
  return String(value);
}

function GuestDiff({ before, after }: { before: unknown; after: unknown }) {
  const b = new Set(((before as { email: string }[]) ?? []).map((a) => a.email));
  const a = new Set(((after as { email: string }[]) ?? []).map((x) => x.email));
  const added = [...a].filter((e) => !b.has(e));
  const removed = [...b].filter((e) => !a.has(e));
  return (
    <span className="flex flex-wrap gap-1">
      {added.map((e) => (
        <Badge key={e} variant="success">
          +{e}
        </Badge>
      ))}
      {removed.map((e) => (
        <Badge key={e} variant="destructive">
          −{e}
        </Badge>
      ))}
      {!added.length && !removed.length ? <span className="text-muted-foreground">roles / names changed</span> : null}
    </span>
  );
}

interface PendingRowProps {
  row: PendingChange;
  tz: string;
  checked?: boolean;
  history?: boolean;
  busy: boolean;
  onCheck?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onOpen: () => void;
  onRetry?: () => void;
  onResolve?: (resolution: "mine" | "theirs") => void;
}

export function PendingRow({ row, tz, checked, history, busy, onCheck, onApprove, onReject, onOpen, onRetry, onResolve }: PendingRowProps) {
  const fields = Object.entries(row.diff);
  const remote = (row.payload.remote as Record<string, unknown>) ?? {};
  const rsvp = row.op === "rsvp" ? (row.payload as { status?: string; previous?: string }) : null;

  return (
    <div className={cn("flex gap-3 rounded-lg border p-3", checked && "border-primary bg-primary/5")}>
      {!history && row.canApprove ? <Checkbox checked={checked} onCheckedChange={onCheck} aria-label="Select change" className="mt-1" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={row.op === "delete" || row.op === "cancel_instance" ? "destructive" : row.op === "create" ? "success" : "secondary"}>
            {OP_LABEL[row.op]}
          </Badge>
          <button type="button" onClick={onOpen} className="min-w-0 truncate text-left text-sm font-semibold hover:underline">
            {row.title || "(no title)"}
          </button>
          {history ? (
            <Badge
              variant={
                row.status === "done"
                  ? "success"
                  : row.status === "rejected"
                    ? "secondary"
                    : row.status === "failed" || row.status === "conflict"
                      ? "destructive"
                      : "outline"
              }
            >
              {row.status === "rejected" ? "kept local" : row.status}
            </Badge>
          ) : null}
        </div>
        <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
          <span className="size-2 rounded-full" style={{ backgroundColor: row.calendarColor }} />
          {row.accountAddress} → {row.calendarName} · {formatRange(row, tz)}
          {row.recurrenceScope !== "all" || row.occurrenceStart ? ` · ${SCOPE_LABEL[row.recurrenceScope]}` : ""}
        </span>

        {rsvp ? (
          <span className="flex items-center gap-1.5 text-xs">
            Response: <span className="text-muted-foreground">{rsvp.previous ?? "—"}</span> <ArrowRight size={11} /> <strong>{rsvp.status}</strong>
          </span>
        ) : null}
        {fields.length && row.op !== "create" ? (
          <div className="flex flex-col gap-1 text-xs">
            {fields.map(([field, d]) => (
              <span key={field} className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground w-24 shrink-0">{FIELD_LABEL[field] ?? field}</span>
                {field === "attendees" ? (
                  <GuestDiff before={d.before} after={d.after} />
                ) : (
                  <>
                    <span className="text-muted-foreground line-through">{show(field, d.before, tz)}</span>
                    <ArrowRight size={11} />
                    <strong className="break-all">{show(field, d.after, tz)}</strong>
                  </>
                )}
                {field in remote ? (
                  <span className="text-warning flex items-center gap-1">
                    <TriangleAlert size={11} /> provider now: {show(field, remote[field], tz)}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <span className="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
          {row.impact.emailsGuests ? (
            <span className="flex items-center gap-1">
              <Mail size={11} /> Will email {row.impact.emailsGuests} guest{row.impact.emailsGuests === 1 ? "" : "s"}
            </span>
          ) : null}
          {row.impact.createsConference ? (
            <span className="flex items-center gap-1">
              <Video size={11} /> Creates a video link
            </span>
          ) : null}
          {row.remoteDeleted ? (
            <span className="text-destructive flex items-center gap-1">
              <CloudOff size={11} /> Event was deleted at the provider — approving recreates it
            </span>
          ) : null}
          <span>
            {row.editorName ? `by ${row.editorName} · ` : ""}
            {new Date(row.updatedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            {history && row.deciderName ? ` · decided by ${row.deciderName}` : ""}
          </span>
        </span>
        {history && row.lastError ? <span className="text-destructive text-xs">{row.lastError}</span> : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {!history && row.canApprove ? (
          <>
            <Button size="sm" disabled={busy} onClick={onApprove}>
              <Check /> Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReject} title="Keep this change in twodb only">
              <X /> Reject
            </Button>
          </>
        ) : null}
        {history && row.status === "failed" && row.canApprove ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {history && row.status === "conflict" && row.canApprove ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve?.("mine")}>
              Keep mine
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onResolve?.("theirs")}>
              Use theirs
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
