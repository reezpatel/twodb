import { Link } from "react-router";
import { CalendarDays, EyeOff, Eye, Loader2, Mail, Pin, PinOff, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { relativeDate, type Contact } from "./contacts-api";
import { useContactDetail } from "./use-contact-detail";

interface ContactDetailProps {
  contact: Contact;
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: { name: string; notes: string }) => Promise<unknown>;
  onToggle: (patch: { pinned?: boolean; hidden?: boolean }) => void;
  onForget: () => void;
}

export function ContactDetail({ contact, canEdit, onClose, onSave, onToggle, onForget }: ContactDetailProps) {
  const { activity, form } = useContactDetail(contact, onSave);
  const label = contact.name || contact.email;

  return (
    <section className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
      <header className="flex items-start gap-3">
        <Avatar size="lg">
          <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-lg font-semibold">{label}</h2>
          <a href={`mailto:${contact.email}`} className="text-muted-foreground truncate text-sm hover:underline">
            {contact.email}
          </a>
        </div>
        {canEdit ? (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={contact.pinned ? "Unpin" : "Pin"} onClick={() => onToggle({ pinned: !contact.pinned })}>
              {contact.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={contact.hidden ? "Show in suggestions" : "Hide from suggestions"}
              onClick={() => onToggle({ hidden: !contact.hidden })}
            >
              {contact.hidden ? <Eye /> : <EyeOff />}
            </Button>
          </>
        ) : null}
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2">
          <div className="text-lg font-semibold tabular-nums">{contact.sentCount}</div>
          <div className="text-muted-foreground text-xs">emails sent</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-lg font-semibold tabular-nums">{contact.receivedCount}</div>
          <div className="text-muted-foreground text-xs">received</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-lg font-semibold tabular-nums">{contact.meetingCount}</div>
          <div className="text-muted-foreground text-xs">meetings</div>
        </div>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" disabled={!canEdit} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="notes">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea id="contact-notes" rows={3} disabled={!canEdit} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        {canEdit ? (
          <form.Subscribe selector={(s) => [s.isSubmitting, s.isDirty] as const}>
            {([submitting, dirty]) => (
              <Button type="submit" size="sm" className="self-end" disabled={submitting || !dirty}>
                {submitting ? <Loader2 className="animate-spin" /> : null} Save
              </Button>
            )}
          </form.Subscribe>
        ) : null}
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Meetings together</h3>
        {activity.isLoading ? <Loader2 className="text-muted-foreground animate-spin" size={14} /> : null}
        {!activity.isLoading && !activity.data?.meetings.length ? <p className="text-muted-foreground text-sm">None in this account.</p> : null}
        {activity.data?.meetings.map((m) => (
          <Link key={m.id} to={`/apps/calendar?event=${m.id}`} className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
            <CalendarDays size={14} className="text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{m.title || "(no title)"}</span>
            <span className="text-muted-foreground text-xs">{relativeDate(m.startAt ?? m.startDate)}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Recent emails</h3>
        {!activity.isLoading && !activity.data?.emails.length ? <p className="text-muted-foreground text-sm">None in this account.</p> : null}
        {activity.data?.emails.map((m) => (
          <Link key={m.id} to={`/apps/email?thread=${m.threadId}`} className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
            <Mail size={14} className="text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{m.subject || "(no subject)"}</span>
            <span className="text-muted-foreground text-xs">{relativeDate(m.sentAt)}</span>
          </Link>
        ))}
      </div>

      {canEdit ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive mt-auto self-start"
          onClick={() => window.confirm(`Forget ${contact.email}? It's removed from this account's contacts and won't be learned again.`) && onForget()}
        >
          <Trash2 /> Forget contact
        </Button>
      ) : null}
    </section>
  );
}
