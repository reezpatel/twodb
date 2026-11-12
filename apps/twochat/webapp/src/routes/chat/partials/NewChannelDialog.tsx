import { useState } from "react";
import { X } from "lucide-react";
import { Button, Input, Label } from "@twodb/blocks";

/**
 * New-channel dialog. Presentational.
 */

export interface NewChannelDialogProps {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onCreate: (name: string, topic: string) => void;
  onClose: () => void;
}

export function NewChannelDialog(props: NewChannelDialogProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={props.onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">New channel</span>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={props.onClose}>
            <X size={14} />
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-channel-name">Name</Label>
            <Input
              id="new-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. engineering"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) props.onCreate(name.trim(), topic.trim());
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-channel-topic">Topic (optional)</Label>
            <Input id="new-channel-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What's this channel about?" />
          </div>
          {props.error ? <p className="text-xs text-red-500">{props.error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={props.onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!name.trim() || props.busy} onClick={() => props.onCreate(name.trim(), topic.trim())}>
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
