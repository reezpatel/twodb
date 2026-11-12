import { useState } from "react";
import { X } from "lucide-react";
import { Button, Input, Label } from "@twodb/blocks";

/**
 * Starts a private conversation by participant id. Once TwoDB exposes a
 * workspace member-directory endpoint this input becomes a searchable picker;
 * the TwoChat DM API is already id-based and needs no backend change.
 */
export function StartDmDialog(props: {
  open: boolean;
  error?: string | null;
  onStart: (participantId: string, kind: "user" | "bot") => void;
  onClose: () => void;
}) {
  const [participantId, setParticipantId] = useState("");
  const [kind, setKind] = useState<"user" | "bot">("user");
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={props.onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">New direct message</span>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={props.onClose}><X size={14} /></Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setKind("user")} className={`rounded-full border px-3 py-1 text-xs ${kind === "user" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Person</button>
            <button type="button" onClick={() => setKind("bot")} className={`rounded-full border px-3 py-1 text-xs ${kind === "bot" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Bot / agent</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dm-participant-id">{kind === "user" ? "User ID" : "Bot ID"}</Label>
            <Input
              id="dm-participant-id"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              placeholder={kind === "user" ? "user_…" : "bot id…"}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && participantId.trim() && props.onStart(participantId.trim(), kind)}
            />
            <span className="text-[11px] text-muted-foreground">Member search will use TwoDB's workspace directory when that endpoint ships.</span>
          </div>
          {props.error ? <p className="text-xs text-red-500">{props.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" disabled={!participantId.trim()} onClick={() => props.onStart(participantId.trim(), kind)}>Open DM</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
