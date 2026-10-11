import { useState } from "react";
import { Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EmailAccount } from "../../email/email-api";
import { useAccountSharing } from "./use-accounts-settings";

export function SharingDialog({ account, onOpenChange }: { account: EmailAccount | null; onOpenChange: (open: boolean) => void }) {
  const { members, orgUsers, setVisibility, upsert, removeMember } = useAccountSharing(account);
  const [pickUser, setPickUser] = useState("");
  const [pickRole, setPickRole] = useState<"member" | "viewer">("member");
  const shared = account?.visibility === "shared";
  const memberIds = new Set((members.data ?? []).map((m) => m.userId));
  const candidates = (orgUsers.data ?? []).filter((u) => !memberIds.has(u.id));
  const error = setVisibility.error ?? upsert.error ?? removeMember.error;

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={16} /> Share {account?.address}
          </DialogTitle>
          <DialogDescription>
            Shared accounts work like a team inbox: members see the same mail, labels, read state and trash. Credentials stay with the owner.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>
            <strong className="block font-medium">Shared account</strong>
            <span className="text-muted-foreground text-xs">Turning sharing off removes every member except you.</span>
          </span>
          <Switch checked={shared} disabled={setVisibility.isPending} onCheckedChange={(v) => setVisibility.mutate(v ? "shared" : "private")} />
        </label>

        {shared ? (
          <div className="flex flex-col gap-2">
            {(members.data ?? []).map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-sm font-medium">{m.name}</strong>
                  <span className="text-muted-foreground truncate text-xs">{m.email}</span>
                </span>
                {m.role === "owner" ? (
                  <Badge variant="secondary">owner</Badge>
                ) : (
                  <>
                    <Select value={m.role} onValueChange={(role) => upsert.mutate({ userId: m.userId, role: role as "member" | "viewer" })}>
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => removeMember.mutate(m.userId)}>
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <Select value={pickUser} onValueChange={setPickUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={candidates.length ? "Add an organization member…" : "Everyone already has access"} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pickRole} onValueChange={(v) => setPickRole(v as "member" | "viewer")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!pickUser || upsert.isPending}
                onClick={() => upsert.mutate({ userId: pickUser, role: pickRole }, { onSuccess: () => setPickUser("") })}
              >
                Add
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">Members can read, organize and send. Viewers can only read.</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
