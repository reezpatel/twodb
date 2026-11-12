import { Database, FileText } from "lucide-react";
import { cn } from "@twodb/blocks";

/** Emoji icon if set, else the kind's default glyph. */
export function RecordIcon({ icon, kind, size = 16, className }: { icon?: string | null; kind: "page" | "database"; size?: number; className?: string }) {
  if (icon) return <span className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)} style={{ fontSize: size * 0.95, width: size, height: size }}>{icon}</span>;
  const Icon = kind === "database" ? Database : FileText;
  return <Icon size={size} strokeWidth={1.6} className={cn("shrink-0 text-ink-muted", className)} />;
}
