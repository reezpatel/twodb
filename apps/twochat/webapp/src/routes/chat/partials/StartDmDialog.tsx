import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, Label } from "@twodb/blocks";
import { chatApi, type Bot } from "../../../lib/chat-client";
import { CollaboratorPicker } from "./CollaboratorPicker";

/**
 * Starts a private conversation. Collaborators (agents) are picked from a list; a person is still addressed by id until
 * TwoDB exposes a workspace member-directory endpoint, at which point that input becomes a picker too.
 */
export function StartDmDialog(props: {
  open: boolean;
  error?: string | null;
  onStart: (participantId: string, kind: "user" | "bot") => void;
  onClose: () => void;
}) {
  const [participantId, setParticipantId] = useState("");
  const [kind, setKind] = useState<"user" | "bot">("bot");
  const [collaborators, setCollaborators] = useState<Bot[] | null>(null);
  const [collaboratorId, setCollaboratorId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Refresh the list every time the dialog opens: collaborators come and go as agents are created in Artisan.
  useEffect(() => {
    if (!props.open) return;
    setParticipantId("");
    setLoadError(null);
    let cancelled = false;
    chatApi
      .listBots()
      .then((bots) => {
        if (cancelled) return;
        const list = bots.filter((bot) => bot.runtimeApp === "artisan");
        setCollaborators(list);
        setCollaboratorId((current) => (list.some((b) => b.id === current && b.enabled !== false) ? current : (list.find((b) => b.enabled !== false)?.id ?? "")));
      })
      .catch((err: Error) => { if (!cancelled) { setCollaborators([]); setLoadError(err.message); } });
    return () => { cancelled = true; };
  }, [props.open]);

  if (!props.open) return null;

  const target = kind === "bot" ? collaboratorId : participantId.trim();
  const start = () => target && props.onStart(target, kind);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={props.onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">New direct message</span>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={props.onClose}><X size={14} /></Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setKind("bot")} className={`rounded-full border px-3 py-1 text-xs ${kind === "bot" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Collaborator</button>
            <button type="button" onClick={() => setKind("user")} className={`rounded-full border px-3 py-1 text-xs ${kind === "user" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Person</button>
          </div>

          {kind === "bot" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dm-collaborator">Collaborator</Label>
              {collaborators === null ? (
                <span className="text-xs text-muted-foreground">Loading…</span>
              ) : collaborators.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  No collaborators yet. Create an agent of type <span className="font-medium text-foreground">Collaborator</span> in Artisan and give it a runner and folder — it shows up here automatically.
                </p>
              ) : (
                <CollaboratorPicker id="dm-collaborator" collaborators={collaborators} value={collaboratorId} onChange={setCollaboratorId} />
              )}
              {loadError ? <span className="text-[11px] text-red-500">Couldn't load collaborators: {loadError}</span> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dm-participant-id">User ID</Label>
              <Input
                id="dm-participant-id"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="user_…"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && start()}
              />
              <span className="text-[11px] text-muted-foreground">Member search will use TwoDB's workspace directory when that endpoint ships.</span>
            </div>
          )}

          {props.error ? <p className="text-xs text-red-500">{props.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" disabled={!target} onClick={start}>Open DM</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
