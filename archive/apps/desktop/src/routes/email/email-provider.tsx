import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  Clock,
  FileText,
  Inbox as InboxIcon,
  Layers,
  Loader2,
  Mail,
  Pencil,
  Send,
  Settings,
  ShieldAlert,
  Star,
  Timer,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SideNav, SideNavFooter, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";
import { initials, type EmailView } from "./email-api";
import { LabelTree } from "./labels/label-tree";
import { useEmailScene } from "./use-email-scene";

/** Email scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export const EmailContext = createContext<ReturnType<typeof useEmailScene> | null>(null);

export function EmailProvider({ children }: { children: ReactNode }) {
  const s = useEmailScene();
  return <EmailContext.Provider value={s}>{children}</EmailContext.Provider>;
}

export function useEmail() {
  const s = useContext(EmailContext);
  if (!s) throw new Error("useEmail must be used within EmailProvider");
  return s;
}

const VIEWS: { id: EmailView; label: string; icon: typeof InboxIcon; count?: "inbox" | "drafts" | "scheduled" | "outbox" | "spam" | "snoozed" }[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon, count: "inbox" },
  { id: "starred", label: "Starred", icon: Star },
  { id: "snoozed", label: "Snoozed", icon: Timer, count: "snoozed" },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText, count: "drafts" },
  { id: "scheduled", label: "Scheduled", icon: Clock, count: "scheduled" },
  { id: "outbox", label: "Outbox", icon: AlertTriangle, count: "outbox" },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "spam", label: "Spam", icon: ShieldAlert, count: "spam" },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "all", label: "All mail", icon: Layers },
];

/** The email sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function EmailSidenav() {
  const s = useEmail();
  const accounts = s.accounts.data ?? [];
  const labels = s.labels.data ?? [];
  const activeAccount = accounts.find((a) => a.id === s.accountId) ?? null;
  const counts = s.counts.data;

  if (s.accounts.isLoading) {
    return (
      <SideNav className="items-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </SideNav>
    );
  }
  if (!accounts.length) return null;

  const attention = accounts.filter((a) => a.status === "error" || a.status === "reauth_required");
  const importing = accounts.filter((a) => a.backfillState === "running");

  return (
    <SideNav>
      <SideNavHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="hover:bg-accent/50 flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left">
              <Avatar size="lg">
                <AvatarFallback className="text-xs">
                  {activeAccount ? initials(activeAccount.displayName ?? activeAccount.address) : <Layers size={14} />}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate text-sm font-semibold">
                  {activeAccount ? (activeAccount.displayName ?? activeAccount.address.split("@")[0]) : "All accounts"}
                </strong>
                <span className="text-muted-foreground truncate text-xs">
                  {activeAccount ? activeAccount.address : `${accounts.length} mailbox${accounts.length === 1 ? "" : "es"}`}
                </span>
              </span>
              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={() => s.setAccountId(null)}>
              <Layers /> All accounts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {accounts.map((a) => (
              <DropdownMenuItem key={a.id} onSelect={() => s.setAccountId(a.id)}>
                <Mail />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{a.address}</span>
                  {a.visibility === "shared" ? <span className="text-muted-foreground text-[11px]">shared · {a.role}</span> : null}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/apps/settings/accounts">
                <Settings /> Manage accounts
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SideNavHeader>
      <Button onClick={() => s.compose.mutate({ composeKind: "new" })} disabled={!s.sendingAccounts.length || s.compose.isPending}>
        {s.compose.isPending ? <Loader2 className="animate-spin" /> : <Pencil size={14} />} Compose
      </Button>
      <SideNavGroup>
        {VIEWS.map((v) => (
          <SideNavItem
            key={v.id}
            label={v.label}
            icon={v.icon}
            count={v.count ? counts?.[v.count] : undefined}
            active={!s.labelId && s.view === v.id}
            onSelect={() => s.setView(v.id)}
            className={v.id === "outbox" && counts?.failed ? "text-destructive" : undefined}
          />
        ))}
      </SideNavGroup>
      <LabelTree labels={labels} accounts={accounts} activeId={s.labelId} onSelect={(id) => s.setLabelId(id)} />
      <SideNavFooter>
        {importing.map((a) => (
          <span key={a.id} className="text-muted-foreground flex items-center gap-1.5 px-2 text-[11px]">
            <Loader2 size={11} className="animate-spin" /> Importing {a.address.split("@")[0]} · {(a.backfillProgress.done ?? 0).toLocaleString()}
            {a.backfillProgress.total ? ` / ${a.backfillProgress.total.toLocaleString()}` : ""}
          </span>
        ))}
        {attention.length ? (
          <Link to="/apps/settings/accounts" className="text-destructive flex items-center gap-1.5 px-2 py-1 text-xs">
            <AlertTriangle size={12} /> {attention.length === 1 ? `${attention[0].address} needs attention` : `${attention.length} accounts need attention`}
          </Link>
        ) : null}
        {s.meta.data && !s.meta.data.storageReady ? (
          <Link to="/apps/settings/storage" className="text-destructive flex items-center gap-1.5 px-2 py-1 text-xs">
            <AlertTriangle size={12} /> Attachment storage not configured
          </Link>
        ) : null}
        <SideNavItem label="Email settings" icon={Settings} to="/apps/settings/accounts" />
      </SideNavFooter>
    </SideNav>
  );
}
