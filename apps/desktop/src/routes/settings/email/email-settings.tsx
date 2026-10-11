import { useRef, useState } from "react";
import { Link } from "react-router";
import { useForm } from "@tanstack/react-form";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { initials, type EmailAccount, type EmailMeta } from "../../email/email-api";
import { AddAccountDialog } from "./add-account-dialog";
import { EditAccountDialog } from "./edit-account-dialog";
import { SharingDialog } from "./sharing-dialog";
import { useEmailSettings, useGmailOAuthForm } from "./use-email-settings";

const STATUS: Record<EmailAccount["status"], { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  active: { label: "Syncing", variant: "success" },
  error: { label: "Error", variant: "destructive" },
  reauth_required: { label: "Reconnect needed", variant: "warning" },
  paused: { label: "Paused", variant: "secondary" },
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function GmailOAuthCard({ meta }: { meta: EmailMeta }) {
  const { save, clear } = useGmailOAuthForm();
  const [copied, setCopied] = useState(false);
  const form = useForm({
    defaultValues: { clientId: meta.gmail.clientId, clientSecret: "" },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
      form.setFieldValue("clientSecret", "");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={16} /> Google OAuth client
          {meta.gmail.configured ? <Badge variant="success">configured</Badge> : <Badge variant="secondary">not configured</Badge>}
        </CardTitle>
        <CardDescription>Each twodb deployment uses its own Google Cloud OAuth client so Gmail accounts can be connected through the Gmail API.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>
            In Google Cloud Console create a project and enable the <strong className="text-foreground">Gmail API</strong>.
          </li>
          <li>
            Configure the OAuth consent screen (External) and add the scopes <code>gmail.readonly</code> and <code>gmail.send</code>.
          </li>
          <li>
            Create an OAuth client of type <strong className="text-foreground">Web application</strong> with the redirect URI below.
          </li>
          <li>Paste the client ID and secret here.</li>
        </ol>
        <Alert>
          <AlertTriangle />
          <AlertTitle>Publish the app to "In production"</AlertTitle>
          <AlertDescription className="text-xs">
            While the consent screen is in <em>Testing</em>, Google expires refresh tokens after 7 days and accounts will need reconnecting. An unverified
            production app shows a warning screen and is limited to 100 users — fine for self-hosting.
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2">
          <Label>Redirect URI</Label>
          <div className="flex gap-2">
            <Input readOnly value={meta.gmail.redirectUri} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy redirect URI"
              onClick={() => {
                void navigator.clipboard.writeText(meta.gmail.redirectUri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckCircle2 /> : <Copy />}
            </Button>
          </div>
        </div>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="clientId">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="gmail-client-id">Client ID</Label>
                <Input id="gmail-client-id" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>
          <form.Field name="clientSecret">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="gmail-client-secret">Client secret</Label>
                <Input
                  id="gmail-client-secret"
                  type="password"
                  placeholder={meta.gmail.configured ? "•••••••• (unchanged)" : ""}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <div className="col-span-2 flex items-center gap-2">
            {save.error ? <span className="text-destructive text-xs">{save.error.message}</span> : null}
            {meta.gmail.configured ? (
              <Button type="button" variant="ghost" className="ml-auto" disabled={clear.isPending} onClick={() => clear.mutate()}>
                Remove
              </Button>
            ) : null}
            <Button type="submit" className={meta.gmail.configured ? undefined : "ml-auto"} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null} Save client
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BackfillBar({ account, onToggle }: { account: EmailAccount; onToggle: (op: "pause" | "resume") => void }) {
  const { done = 0, total } = account.backfillProgress;
  if (account.backfillState === "done" || account.backfillState === "pending") {
    return account.backfillState === "done" ? <span className="text-muted-foreground text-xs">History imported · {done.toLocaleString()} messages</span> : null;
  }
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-1.5 flex-1" />
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {done.toLocaleString()}
        {total ? ` / ${total.toLocaleString()}` : ""} {account.backfillState === "paused" ? "· paused" : "importing history"}
      </span>
      {account.role === "owner" ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={account.backfillState === "paused" ? "Resume history import" : "Pause history import"}
          onClick={() => onToggle(account.backfillState === "paused" ? "resume" : "pause")}
        >
          {account.backfillState === "paused" ? <Play /> : <Pause />}
        </Button>
      ) : null}
    </div>
  );
}

export function EmailSection() {
  const s = useEmailSettings();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [sharing, setSharing] = useState<EmailAccount | null>(null);
  const [deleting, setDeleting] = useState<EmailAccount | null>(null);
  const [purgeMail, setPurgeMail] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);
  const [importFor, setImportFor] = useState<string | null>(null);
  const meta = s.meta.data;
  const accounts = s.accounts.data ?? [];

  const runTest = async (a: EmailAccount) => {
    setTestResult((r) => ({ ...r, [a.id]: "Testing…" }));
    const res = await s.test.mutateAsync(a.id).catch((e: Error) => ({ ok: false, error: e.message }));
    setTestResult((r) => ({ ...r, [a.id]: res.ok ? "Connection OK" : `Failed: ${res.error}` }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Email</h1>
        <p className="text-muted-foreground text-sm">Connected mailboxes, sharing and the Gmail OAuth client. Mail is stored locally in twodb.</p>
      </div>

      {s.oauthNotice ? (
        <Alert variant={s.oauthNotice.ok ? "default" : "destructive"}>
          {s.oauthNotice.ok ? <CheckCircle2 /> : <AlertTriangle />}
          <AlertTitle>{s.oauthNotice.ok ? "Gmail connected" : "Gmail connection failed"}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            {s.oauthNotice.ok ? "Your mailbox is syncing — history imports in the background." : s.oauthNotice.reason}
            <Button variant="ghost" size="xs" onClick={s.dismissNotice}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {meta && !meta.storageReady ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Email attachments storage is not configured</AlertTitle>
          <AlertDescription className="text-xs">
            Synced messages, raw .eml files and attachments are stored in the <strong>Email Attachments</strong> destination. Sync is blocked until it is set
            in{" "}
            <Link to="/apps/settings/storage" className="underline">
              Storage settings
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Gmail via the API, Yahoo and any IMAP/SMTP provider. Private by default; share an account to use it as a team inbox.</CardDescription>
          </div>
          <Button onClick={() => setAdding(true)} disabled={!meta}>
            <Plus /> Add account
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {s.accounts.isLoading ? <Loader2 className="text-muted-foreground animate-spin" /> : null}
          {!s.accounts.isLoading && !accounts.length ? <p className="text-muted-foreground py-6 text-center text-sm">No accounts connected yet.</p> : null}
          {accounts.map((a) => {
            const status = STATUS[a.status];
            const owner = a.role === "owner";
            return (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="text-xs">{initials(a.displayName ?? a.address)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <strong className="truncate text-sm font-medium">{a.displayName ? `${a.displayName} · ${a.address}` : a.address}</strong>
                      <Badge variant="outline">{a.preset === "gmail" ? "Gmail API" : a.preset === "yahoo" ? "Yahoo" : "IMAP/SMTP"}</Badge>
                      {a.visibility === "shared" ? (
                        <Badge variant="secondary">
                          <Users /> shared
                        </Badge>
                      ) : null}
                      {!owner ? <Badge variant="secondary">{a.role}</Badge> : null}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      <Badge variant={status.variant} className="mr-1.5">
                        {status.label}
                      </Badge>
                      last checked {relative(a.lastSyncedAt)}
                      {testResult[a.id] ? ` · ${testResult[a.id]}` : ""}
                    </span>
                  </div>
                  {a.status === "reauth_required" && owner ? (
                    <Button size="sm" variant="outline" onClick={() => (a.kind === "gmail" ? s.startGmail.mutate(a.id) : setEditing(a))}>
                      <Zap /> Reconnect
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Account actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => s.syncNow.mutate(a.id)}>
                        <RefreshCw /> Sync now
                      </DropdownMenuItem>
                      {owner ? (
                        <>
                          <DropdownMenuItem onSelect={() => void runTest(a)}>
                            <Zap /> Test connection
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing(a)}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setSharing(a)}>
                            <Share2 /> Sharing
                          </DropdownMenuItem>
                          {a.kind === "gmail" ? (
                            <DropdownMenuItem onSelect={() => s.startGmail.mutate(a.id)}>
                              <KeyRound /> Reconnect Google
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onSelect={() => {
                              setImportFor(a.id);
                              importRef.current?.click();
                            }}
                          >
                            <Upload /> Import .eml files
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(a)}>
                            <Trash2 /> Remove account
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem onSelect={() => setSharing(a)}>
                          <Users /> Members
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {a.lastError ? <p className="text-destructive text-xs break-words">{a.lastError}</p> : null}
                <BackfillBar account={a} onToggle={(op) => s.backfill.mutate({ id: a.id, op })} />
              </div>
            );
          })}
          {s.importEml.data ? (
            <p className="text-muted-foreground text-xs">
              <Download size={12} className="mr-1 inline" />
              Imported {s.importEml.data.inserted} message(s).
            </p>
          ) : null}
          {s.importEml.error ? <p className="text-destructive text-xs">{s.importEml.error.message}</p> : null}
          <input
            ref={importRef}
            type="file"
            accept=".eml,message/rfc822"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (importFor && files.length) s.importEml.mutate({ id: importFor, files });
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spam rules</CardTitle>
          <CardDescription>Senders and domains you chose to always route to Spam. Applied locally to newly synced mail.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {!(s.senderRules.data ?? []).length ? <p className="text-muted-foreground text-sm">No rules yet — use "Always send to Spam" when marking mail as spam.</p> : null}
          {(s.senderRules.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <Badge variant="outline">{r.matchType}</Badge>
              <span className="flex-1 truncate font-mono text-xs">{r.matchType === "domain" ? `@${r.value}` : r.value}</span>
              <Button variant="ghost" size="icon-xs" aria-label="Delete rule" onClick={() => s.removeRule.mutate(r.id)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {meta?.isAdmin ? <GmailOAuthCard key={meta.gmail.clientId} meta={meta} /> : null}

      {meta ? <AddAccountDialog open={adding} onOpenChange={setAdding} meta={meta} onGmail={() => s.startGmail.mutate(undefined)} gmailPending={s.startGmail.isPending} /> : null}
      <EditAccountDialog account={editing} onOpenChange={(o) => !o && setEditing(null)} onSave={(patch) => s.update.mutateAsync({ id: editing!.id, patch })} />
      <SharingDialog account={sharing ? (accounts.find((a) => a.id === sharing.id) ?? sharing) : null} onOpenChange={(o) => !o && setSharing(null)} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.address}?</DialogTitle>
            <DialogDescription>Sync stops and the stored credentials are deleted. Nothing is deleted at the provider.</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={purgeMail} onCheckedChange={(v) => setPurgeMail(v === true)} />
            <span>
              Also delete all locally stored mail and attachments for this account
              <span className="text-muted-foreground block text-xs">Otherwise the mail stays stored but is no longer shown.</span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={s.remove.isPending}
              onClick={() =>
                deleting &&
                s.remove.mutate(
                  { id: deleting.id, purgeMail },
                  {
                    onSuccess: () => {
                      setDeleting(null);
                      setPurgeMail(false);
                    },
                  },
                )
              }
            >
              {s.remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
