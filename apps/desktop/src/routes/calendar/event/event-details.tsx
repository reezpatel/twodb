import {
  CalendarClock,
  Check,
  CircleHelp,
  CloudUpload,
  Copy,
  Download,
  HardDrive,
  Loader2,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRange, type Occurrence, type RecurrenceScope } from "../calendar-api";
import { useEventDetails } from "./use-event-details";

const STATUS_ICON: Record<string, { icon: typeof Check; className: string; label: string }> = {
  accepted: { icon: Check, className: "text-success", label: "Going" },
  declined: { icon: X, className: "text-destructive", label: "Declined" },
  tentative: { icon: CircleHelp, className: "text-warning", label: "Maybe" },
  needs_action: { icon: CircleHelp, className: "text-muted-foreground", label: "Awaiting" },
};

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  descriptionHtml: "description",
  location: "location",
  time: "time",
  rrule: "repeat",
  attendees: "guests",
  reminders: "reminders",
  conference: "video call",
  status: "status",
  color: "color",
};

interface EventDetailsProps {
  occurrence: Occurrence;
  tz: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
  onOpenPending: () => void;
  withScope: (o: Occurrence, title: string, run: (scope: RecurrenceScope) => void, opts?: { allowFollowing?: boolean }) => void;
}

export function EventDetails({ occurrence, tz, onClose, onEdit, onDelete, onChanged, onOpenPending, withScope }: EventDetailsProps) {
  const d = useEventDetails(occurrence, onChanged);
  const data = d.detail.data;
  const e = data?.event;
  const going = data?.attendees.filter((a) => a.status === "accepted").length ?? 0;
  const declined = data?.attendees.filter((a) => a.status === "declined").length ?? 0;
  const awaiting = data?.attendees.filter((a) => a.status === "needs_action").length ?? 0;
  const pending = data?.pending ?? [];
  const failed = pending.find((p) => p.status === "failed" || p.status === "conflict");

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l p-5" aria-label="Event details">
      <header className="flex items-start gap-2">
        <span className="mt-1.5 size-3 shrink-0 rounded" style={{ backgroundColor: occurrence.color ?? data?.calendar.color ?? "var(--color-primary)" }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className={cn("text-lg leading-snug font-semibold break-words", e?.status === "cancelled" && "line-through")}>
            {occurrence.title || "(no title)"}
          </h2>
          <span className="text-muted-foreground text-sm">{formatRange(e ?? { ...occurrence, startAt: occurrence.startAt, endAt: occurrence.endAt }, tz)}</span>
          {occurrence.isRecurring ? (
            <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <Repeat size={12} /> {data?.recurrenceText ?? "Repeats"}
            </span>
          ) : null}
        </div>
        {data?.canEdit ? (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={onDelete}>
              <Trash2 />
            </Button>
          </>
        ) : null}
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      {d.detail.isLoading ? <Loader2 className="text-muted-foreground animate-spin" /> : null}

      {pending.some((p) => p.status === "awaiting_approval") ? (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
          <CloudUpload size={14} className="shrink-0" />
          <span className="flex-1">Not pushed — this change waits in Pending push until someone approves it.</span>
          <Button size="xs" variant="outline" onClick={onOpenPending}>
            Review
          </Button>
        </div>
      ) : null}
      {failed ? (
        <div className="border-destructive/40 bg-destructive/5 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
          <TriangleAlert size={14} className="text-destructive shrink-0" />
          <span className="flex-1">
            {failed.status === "conflict"
              ? "Changed at the provider too — choose which version to keep."
              : `Push failed: ${failed.lastError ?? "unknown error"}`}
          </span>
          <Button size="xs" variant="outline" onClick={onOpenPending}>
            Resolve
          </Button>
        </div>
      ) : null}
      {e && (e.localOnly || d.pinnedFields.length || e.localDeletedAt) ? (
        <div className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-2.5 text-xs">
          <span className="flex items-center gap-2">
            <HardDrive size={14} className="shrink-0" />
            {e.localOnly
              ? "Local only — this event was never sent to the provider."
              : `Local only: ${d.pinnedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")} kept in twodb; the provider has its own version.`}
          </span>
          {Object.entries(e.localOnlyFields)
            .filter(([, v]) => v.remoteValue !== undefined)
            .map(([f, v]) => (
              <span key={f} className="text-muted-foreground pl-6">
                Provider now says {FIELD_LABELS[f] ?? f}: <strong>{typeof v.remoteValue === "string" ? v.remoteValue : JSON.stringify(v.remoteValue)}</strong>
              </span>
            ))}
          {data?.canApprove ? (
            <span className="flex gap-2 pl-6">
              <Button size="xs" variant="outline" disabled={d.pushNow.isPending} onClick={() => d.pushNow.mutate()}>
                Push now
              </Button>
              <Button size="xs" variant="ghost" disabled={d.discardLocal.isPending} onClick={() => d.discardLocal.mutate()}>
                Discard local changes
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}

      {e?.conference?.url ? (
        <Button asChild className="self-start">
          <a href={e.conference.url} target="_blank" rel="noreferrer">
            <Video /> Join {e.conference.type === "meet" ? "Google Meet" : e.conference.type === "teams" ? "Teams" : "video call"}
          </a>
        </Button>
      ) : e?.conference?.create ? (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Video size={13} /> Video link is created when the event is pushed
        </span>
      ) : null}

      {e?.location ? (
        <span className="flex items-start gap-2 text-sm">
          <MapPin size={15} className="text-muted-foreground mt-0.5 shrink-0" />
          <span className="break-words">{e.location}</span>
        </span>
      ) : null}

      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        <CalendarClock size={15} className="shrink-0" /> {data?.calendar.name}
        {e?.transparency === "transparent" ? <Badge variant="secondary">free</Badge> : null}
        {e?.visibility === "private" ? <Badge variant="secondary">private</Badge> : null}
        {e?.eventType && e.eventType !== "default" ? <Badge variant="outline">{e.eventType.replace(/_/g, " ")}</Badge> : null}
      </span>

      {data?.attendees.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users size={15} className="text-muted-foreground" /> {data.attendees.length} guests
            <span className="text-muted-foreground text-xs font-normal">
              {going} yes{declined ? ` · ${declined} no` : ""}
              {awaiting ? ` · ${awaiting} awaiting` : ""}
            </span>
          </span>
          {data.attendees.map((a) => {
            const st = STATUS_ICON[a.status] ?? STATUS_ICON.needs_action;
            const Icon = st.icon;
            return (
              <span key={a.id} className="flex items-center gap-2 pl-6 text-sm" title={a.email}>
                <UserRound size={13} className="text-muted-foreground shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {a.name || a.email}
                  {a.isOrganizer ? <span className="text-muted-foreground text-xs"> · organizer</span> : null}
                  {a.isSelf ? <span className="text-muted-foreground text-xs"> · you</span> : null}
                  {a.role === "optional" ? <span className="text-muted-foreground text-xs"> · optional</span> : null}
                </span>
                <Icon size={13} className={cn("shrink-0", st.className)} aria-label={st.label} />
              </span>
            );
          })}
        </div>
      ) : null}

      {d.self && !d.isOrganizer && e?.status !== "cancelled" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border p-2.5">
          <span className="text-xs font-medium">Going?</span>
          <div className="flex gap-1.5">
            {(["accepted", "tentative", "declined"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={d.self?.status === status ? "default" : "outline"}
                disabled={d.rsvp.isPending}
                onClick={() =>
                  withScope(occurrence, "Respond to", (scope) => d.rsvp.mutate({ status, scope: scope === "following" ? "all" : scope }), {
                    allowFollowing: false,
                  })
                }
              >
                {status === "accepted" ? "Yes" : status === "tentative" ? "Maybe" : "No"}
              </Button>
            ))}
          </div>
          {data?.calendar.accountId ? (
            <span className="text-muted-foreground text-[11px]">Your response goes to the organizer after approval in Pending push.</span>
          ) : null}
        </div>
      ) : null}

      {d.descriptionHtml ? <div className="prose-sm text-sm break-words [&_a]:underline" dangerouslySetInnerHTML={{ __html: d.descriptionHtml }} /> : null}

      <div className="mt-auto flex flex-wrap gap-1.5 border-t pt-3">
        <Button variant="ghost" size="sm" disabled={d.duplicate.isPending} onClick={() => d.duplicate.mutate()}>
          <Copy /> Duplicate
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={d.exportUrl} download>
            <Download /> .ics
          </a>
        </Button>
        {e?.deletedAt ? (
          <Button variant="outline" size="sm" onClick={() => d.restore.mutate()}>
            Restore
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
