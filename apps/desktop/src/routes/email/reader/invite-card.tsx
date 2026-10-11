import { Link } from "react-router";
import { CalendarDays, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browserTz, formatRange } from "../../calendar/calendar-api";
import { useInviteCard } from "./use-invite-card";

/** RSVP card for messages that carry a calendar invitation (iMIP). */
export function InviteCard({ messageId }: { messageId: string }) {
  const { invite, respond } = useInviteCard(messageId);
  const data = invite.data;
  if (!data?.summary) return null;
  const s = data.summary;
  const cancelled = data.method === "CANCEL";
  const isReply = data.method === "REPLY";

  return (
    <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md">
          <CalendarDays size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className={cancelled ? "text-sm line-through" : "text-sm"}>{s.title || "(no title)"}</strong>
          <span className="text-muted-foreground text-xs">
            {formatRange(s, browserTz())}
            {s.recurring ? " · repeats" : ""}
          </span>
          {s.location ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <MapPin size={11} /> {s.location}
            </span>
          ) : null}
          {s.organizer ? (
            <span className="text-muted-foreground text-xs">
              Organizer: {s.organizer.name || s.organizer.email}
              {s.attendeeCount ? ` · ${s.attendeeCount} guests` : ""}
            </span>
          ) : null}
        </div>
        {s.conference?.url ? (
          <Button size="xs" variant="outline" asChild>
            <a href={s.conference.url} target="_blank" rel="noreferrer">
              <Video /> Join
            </a>
          </Button>
        ) : null}
      </div>
      {cancelled ? <span className="text-destructive text-xs">This event was cancelled.</span> : null}
      {isReply ? (
        <span className="text-muted-foreground text-xs">
          A guest replied to your invitation{data.result === "reply_applied" ? " — their response is updated in your calendar." : "."}
        </span>
      ) : null}
      {!cancelled && !isReply ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium">Going?</span>
          {(["accepted", "tentative", "declined"] as const).map((status) => (
            <Button
              key={status}
              size="xs"
              variant={data.selfStatus === status ? "default" : "outline"}
              disabled={respond.isPending}
              onClick={() => respond.mutate(status)}
            >
              {status === "accepted" ? "Yes" : status === "tentative" ? "Maybe" : "No"}
            </Button>
          ))}
          {data.eventId ? (
            <Link to={`/apps/calendar?event=${data.eventId}`} className="text-primary ml-auto text-xs hover:underline">
              Open in calendar
            </Link>
          ) : null}
          {respond.error ? <span className="text-destructive text-xs">{respond.error.message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
