import { CloudUpload, HardDrive, Repeat, TriangleAlert, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Occurrence } from "../calendar-api";

/** Sync markers shown on every event rendering: waiting for approval, failed/conflict, kept local only. */
export function PushMarker({ o, size = 11 }: { o: Pick<Occurrence, "pushState" | "localOnly">; size?: number }) {
  if (o.pushState === "failed" || o.pushState === "conflict")
    return <TriangleAlert size={size} className="text-destructive shrink-0" aria-label="Push failed" />;
  if (o.pushState === "awaiting_approval" || o.pushState === "pending")
    return <CloudUpload size={size} className="shrink-0 opacity-70" aria-label="Not pushed" />;
  if (o.localOnly) return <HardDrive size={size} className="shrink-0 opacity-70" aria-label="Local only" />;
  return null;
}

export function chipStyle(color: string, o: Pick<Occurrence, "selfStatus" | "status" | "transparency">) {
  const pending = o.selfStatus === "needs_action" || o.status === "tentative";
  return {
    backgroundColor: pending ? "transparent" : `color-mix(in oklab, ${color} 18%, var(--color-background))`,
    borderColor: color,
    borderStyle: pending ? "dashed" : "solid",
  };
}

export function ChipIcons({ o }: { o: Occurrence }) {
  return (
    <>
      {o.isRecurring ? <Repeat size={10} className="shrink-0 opacity-60" /> : null}
      {o.hasConference ? <Video size={10} className="shrink-0 opacity-60" /> : null}
      <PushMarker o={o} size={10} />
    </>
  );
}

export function declinedClass(o: Occurrence) {
  return cn(o.selfStatus === "declined" && "line-through opacity-50", o.status === "cancelled" && "line-through opacity-50");
}
