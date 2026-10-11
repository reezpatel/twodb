import { useForm } from "@tanstack/react-form";
import { BookUser, Calendar, Loader2, Mail, Pin, Plus, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SideNav, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";
import { cn } from "@/lib/utils";
import { relativeDate } from "./contacts-api";
import { ContactDetail } from "./contact-detail";
import { useContactsScene } from "./use-contacts-scene";

function AddContactForm({
  onSubmit,
  pending,
  error,
  onCancel,
}: {
  onSubmit: (v: { email: string; name: string }) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const form = useForm({ defaultValues: { email: "", name: "" }, onSubmit: ({ value }) => onSubmit(value) });
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <Input autoFocus placeholder="email@example.com" type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        )}
      </form.Field>
      <form.Field name="name">
        {(field) => <Input placeholder="Name (optional)" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
      </form.Field>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe selector={(st) => st.values.email}>
          {(email) => (
            <Button type="submit" size="sm" disabled={pending || !email}>
              {pending ? <Loader2 className="animate-spin" /> : null} Add
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

export function ContactsScene() {
  const s = useContactsScene();
  const books = s.books.data ?? [];

  return (
    <div className="bg-background grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[220px_minmax(320px,1fr)_420px]">
      <SideNav>
        <SideNavHeader title="Contacts" description="Learned from your mail and meetings — one list per account." />
        <SideNavGroup label="Accounts">
          {books
            .filter((b) => b.kind === "account")
            .map((b) => (
              <SideNavItem key={b.id} label={b.label} icon={Mail} count={b.count} active={b.id === s.bookId} onSelect={() => s.selectBook(b.id)} />
            ))}
        </SideNavGroup>
        <SideNavGroup label="twodb" separated>
          {books
            .filter((b) => b.kind === "local")
            .map((b) => (
              <SideNavItem key={b.id} label="twodb calendars" icon={Calendar} count={b.count} active={b.id === s.bookId} onSelect={() => s.selectBook(b.id)} />
            ))}
        </SideNavGroup>
        {s.book?.learnState === "running" ? (
          <p className="text-muted-foreground mt-auto flex items-center gap-1.5 px-2 text-xs">
            <Loader2 size={12} className="animate-spin" /> Learning from stored mail · {s.book.learnProgress.done?.toLocaleString() ?? 0}
            {s.book.learnProgress.total ? ` / ${s.book.learnProgress.total.toLocaleString()}` : ""}
          </p>
        ) : null}
      </SideNav>

      <section className="flex min-h-0 min-w-0 flex-col gap-3 border-r p-4">
        <header className="flex items-center gap-2">
          <h3 className="truncate text-lg font-semibold">{s.book?.kind === "local" ? "twodb calendars" : (s.book?.label ?? "Contacts")}</h3>
          {s.list.data ? <span className="text-muted-foreground text-xs">{s.list.data.total.toLocaleString()} people</span> : null}
          {s.canEdit ? (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => s.setAdding(true)}>
              <Plus /> Add
            </Button>
          ) : null}
        </header>
        {s.adding ? (
          <AddContactForm
            pending={s.create.isPending}
            error={s.create.error?.message ?? null}
            onCancel={() => s.setAdding(false)}
            onSubmit={(v) => s.create.mutate(v)}
          />
        ) : null}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
            <Input
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={s.sort} onValueChange={(v) => s.setSort(v as typeof s.sort)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">Most contacted</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {s.list.data?.domains.length ? (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => s.setDomain(null)} className={cn("rounded-full border px-2 py-0.5 text-xs", !s.domain && "bg-accent")}>
              All
            </button>
            {s.list.data.domains.slice(0, 12).map((d) => (
              <button
                key={d.domain}
                type="button"
                onClick={() => s.setDomain(s.domain === d.domain ? null : d.domain)}
                className={cn("rounded-full border px-2 py-0.5 text-xs", s.domain === d.domain && "bg-accent")}
              >
                {d.domain} <span className="text-muted-foreground">{d.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={s.showHidden} onCheckedChange={s.setShowHidden} /> Show hidden
        </label>
        <div className="-mr-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
          {s.list.isLoading ? <Loader2 className="text-muted-foreground m-auto animate-spin" /> : null}
          {!s.list.isLoading && !s.contacts.length ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
              <BookUser size={18} />
              {s.query || s.domain ? "No one matches." : "No contacts yet. People you email or meet through this account show up here."}
            </div>
          ) : null}
          {s.contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => s.setSelected(c.id)}
              className={cn(
                "hover:bg-accent/50 flex items-center gap-3 rounded-lg px-2 py-2 text-left",
                s.selected === c.id && "bg-accent",
                c.hidden && "opacity-60",
              )}
            >
              <Avatar>
                <AvatarFallback className="text-xs">{(c.name || c.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <strong className="truncate text-sm font-medium">{c.name || c.email}</strong>
                  {c.pinned ? <Pin size={11} className="text-primary shrink-0" /> : null}
                  {c.hidden ? <Badge variant="secondary">hidden</Badge> : null}
                </span>
                <span className="text-muted-foreground truncate text-xs">{c.name ? c.email : c.domain}</span>
              </span>
              <span className="text-muted-foreground flex shrink-0 flex-col items-end text-[11px]">
                {c.nextMeetingAt ? <span className="text-primary">next {relativeDate(c.nextMeetingAt)}</span> : null}
                <span>{relativeDate(c.lastSeenAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="hidden min-h-0 lg:flex lg:flex-col">
        {s.selectedContact ? (
          <ContactDetail
            key={s.selectedContact.id}
            contact={s.selectedContact}
            canEdit={s.canEdit}
            onClose={() => s.setSelected(null)}
            onSave={(patch) => s.update.mutateAsync({ id: s.selectedContact!.id, patch })}
            onToggle={(patch) => s.update.mutate({ id: s.selectedContact!.id, patch })}
            onForget={() => s.forget.mutate(s.selectedContact!.id)}
          />
        ) : (
          <div className="text-muted-foreground m-auto flex flex-col items-center gap-2 text-sm">
            <Users size={18} />
            Select a person
          </div>
        )}
      </div>
    </div>
  );
}
