import { useState } from "react";
import {
  Archive,
  AtSign,
  Bell,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  FileArchive,
  FileText,
  Inbox as InboxIcon,
  Link,
  MailPlus,
  Paperclip,
  Pencil,
  Pin,
  Reply,
  Search,
  Send,
  ShieldAlert,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EmailMessage, EmailThread } from "./use-email-scene";
import { useEmailScene } from "./use-email-scene";

const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: InboxIcon, count: 340 },
  { id: "starred", label: "Starred", icon: Star, count: 3 },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText, count: 8 },
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "spam", label: "Spam", icon: ShieldAlert },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const RECIPIENTS = [
  { name: "Sam Jones", email: "samjones@gmail.com" },
  { name: "Mike Mints", email: "mikemints@gmail.com" },
];

const ATTACHMENTS = [
  { name: "Design Draft.fig", size: "2 MB", kind: "figma" },
  { name: "Product Flow.blend", size: "48 MB", kind: "blend" },
  { name: "Presentation.pdf", size: "2 MB", kind: "pdf" },
];

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function Pill({ person, removable = true }: { person: { name: string; email: string }; removable?: boolean }) {
  return (
    <span className="bg-muted/50 inline-flex h-8 min-w-0 max-w-55 items-center gap-1.5 rounded-full border px-1.5 py-0.5 pr-1">
      <Avatar size="sm">
        <AvatarFallback className="text-[10px]">{initials(person.name)}</AvatarFallback>
      </Avatar>
      <strong className="truncate text-xs font-semibold">{person.email}</strong>
      {removable ? (
        <button
          type="button"
          aria-label={`Remove ${person.email}`}
          className="text-muted-foreground hover:text-foreground grid size-6 place-items-center rounded-full transition-colors"
        >
          <X size={13} />
        </button>
      ) : null}
    </span>
  );
}

function FileMark({ kind }: { kind: string }) {
  if (kind === "figma") {
    return (
      <span className="bg-card grid size-9.5 shrink-0 grid-cols-2 grid-rows-2 place-items-center gap-0.5 rounded-md border p-1.5" aria-label="Figma file">
        <i className="size-2 rounded-full bg-[#f24e1e]" />
        <i className="size-2 rounded-full bg-[#ff7262]" />
        <i className="size-2 rounded-full bg-[#a259ff]" />
        <i className="size-2 rounded-full bg-[#1abcfe]" />
      </span>
    );
  }
  return (
    <span className="bg-card grid size-9.5 shrink-0 place-items-center rounded-md border" aria-label={kind === "blend" ? "Blender file" : "PDF file"}>
      {kind === "blend" ? <FileArchive size={17} className="text-orange-500" /> : <FileText size={17} className="text-red-500" />}
    </span>
  );
}

function Attachment({ item }: { item: (typeof ATTACHMENTS)[number] }) {
  return (
    <div className="bg-muted/50 flex min-w-0 items-center gap-2 rounded-lg border p-2.5">
      <FileMark kind={item.kind} />
      <span className="min-w-0">
        <strong className="block truncate text-xs font-semibold">{item.name}</strong>
        <em className="text-muted-foreground mt-0.5 block text-[11px] not-italic">{item.size}</em>
      </span>
    </div>
  );
}

function ComposeWindow({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-4 bottom-4 z-50 w-[min(720px,calc(100%-32px))]" aria-label="Compose new email">
      <section className="bg-background border-border/80 relative w-full rounded-2xl border p-4 shadow-2xl">
        <header className="flex items-center justify-between gap-3 px-1.5 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground grid size-6 place-items-center">
              <MailPlus size={16} strokeWidth={1.85} />
            </span>
            <h2 className="text-base leading-tight font-bold">Compose New Email</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Open full screen">
              <ExternalLink size={15} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Close compose" onClick={onClose}>
              <X size={15} />
            </Button>
          </div>
        </header>

        <div className="bg-card rounded-2xl border p-6">
          <div className="flex min-h-9 items-center gap-2 py-0.5">
            <span className="w-10.5 shrink-0 text-sm font-semibold">From</span>
            <Pill person={{ name: "Alex White", email: "alex.white@gmail.com" }} />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground grid size-6 place-items-center rounded-full transition-colors"
              aria-label="Choose sender"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="flex min-h-9 flex-wrap items-center gap-2 py-0.5">
            <span className="w-10.5 shrink-0 text-sm font-semibold">To</span>
            {RECIPIENTS.map((person) => (
              <Pill key={person.email} person={person} />
            ))}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="xs">
                Cc
              </Button>
              <Button variant="secondary" size="xs">
                Bcc
              </Button>
            </div>
          </div>
          <div className="my-2 mb-4 h-px bg-border" />

          <article className="max-w-150">
            <h3 className="mb-4 text-base leading-snug font-bold">Research Result and Attached Files for the Call</h3>
            <p className="mb-3 text-sm leading-relaxed">Hey Mike,</p>
            <p className="mb-3 text-sm leading-relaxed">
              Regarding our latest call, I&rsquo;ve done research and collected all the base that we need to proceed on this product. I&rsquo;m sending you all
              the materials in the attached files below, so you could take a closer look and get prepared for the upcoming catch up.
            </p>
            <p className="mb-3 text-sm leading-relaxed">Looking forward to moving this forward!</p>
            <p className="text-sm leading-relaxed">
              Best regards,
              <br />
              Tim
            </p>
          </article>

          <div className="mt-5 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {ATTACHMENTS.map((item) => (
              <Attachment key={item.name} item={item} />
            ))}
          </div>
        </div>

        <footer className="flex items-center gap-2 pt-4 pb-1">
          <div className="flex flex-1 items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Formatting">
              <Type size={15} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Attach file">
              <Paperclip size={15} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Insert link">
              <Link size={15} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Emoji">
              <Smile size={15} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Schedule">
              <CalendarPlus size={15} />
            </Button>
          </div>
          <Button className="h-10 min-w-30 rounded-full px-6">Send email</Button>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Discard draft" onClick={onClose}>
            <Trash2 size={15} />
          </Button>
        </footer>
        <div className="bg-card text-muted-foreground absolute right-6 bottom-18 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
          <AtSign size={13} /> Draft ready · 3 files attached
        </div>
      </section>
    </div>
  );
}

function ThreadRow({ thread, active, onSelect }: { thread: EmailThread; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-accent/50 relative flex w-full items-start gap-2 rounded-lg px-2 py-2.5 text-left transition-colors",
        active && "bg-accent hover:bg-accent shadow-[inset_2px_0_0_var(--color-primary)]",
      )}
      onClick={onSelect}
    >
      <Avatar>
        <AvatarFallback className="text-xs">{initials(thread.from)}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <strong className="truncate text-sm font-semibold">{thread.from}</strong>
          {thread.count ? <Badge variant="secondary">{thread.count}</Badge> : null}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">{thread.time}</span>
        </span>
        <span className="text-muted-foreground truncate text-xs">{thread.snippet}</span>
      </span>
      {thread.unread ? <i className="bg-primary absolute right-2 bottom-2.5 size-1.5 rounded-full" aria-label="Unread" /> : null}
    </button>
  );
}

function MessageBlock({ message }: { message: EmailMessage }) {
  const [starred, setStarred] = useState(false);
  return (
    <article className="flex flex-col gap-3 border-t pt-4">
      <header className="flex items-center gap-2">
        <Avatar>
          <AvatarFallback className="text-xs">{initials(message.author)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="truncate text-sm font-semibold">{message.author}</strong>
          <span className="text-muted-foreground truncate text-xs">{message.email}</span>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{message.time}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={starred ? "Unstar" : "Star"}
          className={starred ? "text-primary" : undefined}
          onClick={() => setStarred((s) => !s)}
        >
          <Star size={14} fill={starred ? "currentColor" : "none"} />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Reply">
          <Reply size={14} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="More actions">
              <CornerUpRight size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <CornerUpLeft /> Reply all
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pin /> Pin message
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-0.5 text-xs">To</span>
        {message.to.map((t) => (
          <span key={t} className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
            <Avatar size="sm">
              <AvatarFallback className="text-[9px]">{initials(t)}</AvatarFallback>
            </Avatar>
            {t}
          </span>
        ))}
        {message.cc ? (
          <>
            <span className="text-muted-foreground mr-0.5 text-xs">Cc</span>
            {message.cc.map((t) => (
              <span key={t} className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
                <Avatar size="sm">
                  <AvatarFallback className="text-[9px]">{initials(t)}</AvatarFallback>
                </Avatar>
                {t}
              </span>
            ))}
          </>
        ) : null}
      </div>
      <p className="text-muted-foreground m-0 max-w-[65ch] text-sm leading-relaxed">{message.body}</p>
      {message.attachments ? (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <span key={a.name} className="bg-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium">
              <FileText size={13} className="text-red-500" />
              {a.name}
              <em className="text-muted-foreground text-[11px] not-italic tabular-nums">{a.size}</em>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function EmailScene() {
  const email = useEmailScene();
  const activeFolder = FOLDERS.find((f) => f.id === email.folder);

  return (
    <div className="bg-background relative grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[220px_330px_1fr]">
      <aside className="bg-muted/20 flex flex-col gap-3 border-r p-4 px-3">
        <div className="flex items-center gap-2 px-1">
          <Avatar size="lg">
            <AvatarFallback className="text-xs">{initials("Uxerflow")}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-sm font-semibold">Uxerflow</strong>
            <span className="text-muted-foreground truncate text-xs">uxerflow@gmail.design</span>
          </div>
        </div>
        <Button onClick={() => email.setComposeOpen(true)}>
          <Pencil size={14} /> Compose
        </Button>
        <nav className="flex flex-col gap-0.5">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const isActive = f.id === email.folder;
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "hover:bg-accent/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
                onClick={() => email.setFolder(f.id)}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 text-left">{f.label}</span>
                {f.count ? <span className="text-xs tabular-nums">{f.count}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-col gap-0.5 border-t pt-2">
          <span className="text-muted-foreground/70 px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">Labels</span>
          {email.labels.map((l) => (
            <span key={l.id} className="text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <i className={cn("size-2 shrink-0 rounded-sm", l.dotClass)} />
              {l.label}
              <b className="ml-auto text-xs font-medium tabular-nums">{l.count}</b>
            </span>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-0.5">
          <button type="button" className="text-muted-foreground hover:bg-accent/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors">
            <Sparkles size={15} /> Settings
          </button>
          <button type="button" className="text-muted-foreground hover:bg-accent/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors">
            <Bell size={15} /> Help Center
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-3 border-r p-4 px-3">
        <header className="flex items-baseline gap-2">
          <h3 className="text-lg font-semibold">{activeFolder?.label ?? "Inbox"}</h3>
          <span className="text-muted-foreground text-xs">340 messages</span>
        </header>
        <div className="relative">
          <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
          <Input
            value={email.query}
            onChange={(e) => email.setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search messages"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex -mr-2 min-h-0 flex-1 flex-col overflow-y-auto">
          {email.pinned.length ? (
            <>
              <span className="text-muted-foreground/70 flex items-center gap-1 px-2 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
                <Pin size={10} /> Pinned
              </span>
              {email.pinned.map((t) => (
                <ThreadRow key={t.id} thread={t} active={email.selected === t.id} onSelect={() => email.setSelected(t.id)} />
              ))}
            </>
          ) : null}
          {email.rest.length ? (
            <>
              <span className="text-muted-foreground/70 px-2 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">Primary</span>
              {email.rest.map((t) => (
                <ThreadRow key={t.id} thread={t} active={email.selected === t.id} onSelect={() => email.setSelected(t.id)} />
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="hidden min-w-0 flex-col lg:flex">
        {email.activeThread ? (
          email.messages.length ? (
            <>
              <div className="flex items-center gap-0.5 border-b px-3 py-2">
                <Button variant="ghost" size="icon-sm" aria-label="Reply">
                  <Reply size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Reply all">
                  <CornerUpLeft size={15} />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="AI summary">
                      <Sparkles size={15} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Summarize with AI</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="icon-sm" aria-label="Pin">
                  <Pin size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Star">
                  <Star size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Snooze">
                  <Clock size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete">
                  <Trash2 size={15} />
                </Button>
                <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs tabular-nums">
                  1 of 340
                  <Button variant="ghost" size="icon-xs" aria-label="Newer">
                    <ChevronLeft size={13} />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label="Older">
                    <ChevronRight size={13} />
                  </Button>
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Close conversation" onClick={() => email.setSelected(null)}>
                  <ChevronRight size={15} />
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-4 pb-10">
                  <span className="text-muted-foreground text-xs tabular-nums">June 24, 2026 · 10:15 AM</span>
                  <h3 className="flex items-center gap-2 text-xl font-semibold">
                    Re: Sitemap Refinements <Badge variant="secondary">10</Badge>
                  </h3>

                  <div className="bg-primary/5 border-primary/25 rounded-lg border p-3 px-4">
                    <span className="text-primary mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
                      <Sparkles size={13} /> Summary
                    </span>
                    <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                      The navigation layout has been revamped, and a new section for quick access to frequently used features has been added. Margins have been
                      adjusted to meet updated design standards. Feedback is requested before moving forward.
                    </p>
                  </div>

                  {email.messages.map((m) => (
                    <MessageBlock key={m.id} message={m} />
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center text-sm">
              <p className="m-0 leading-relaxed">
                <strong className="text-foreground">{email.activeThread.from}</strong> — this conversation&rsquo;s messages come with the mail connection. The
                sitemap thread is fully mocked.
              </p>
              <Button variant="secondary" size="sm" onClick={() => email.setSelected("sitemap")}>
                Open the sitemap thread
              </Button>
            </div>
          )
        ) : (
          <div className="text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center text-sm">
            <p className="m-0">No conversation selected.</p>
            <Button variant="secondary" size="sm" onClick={() => email.setSelected("sitemap")}>
              Open the sitemap thread
            </Button>
          </div>
        )}
      </section>

      {email.composeOpen ? <ComposeWindow onClose={() => email.setComposeOpen(false)} /> : null}
    </div>
  );
}
