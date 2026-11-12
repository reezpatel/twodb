import { Link } from "react-router";
import { FileText, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Section } from "./Section";
import { get } from "../../lib/api";
import { useProjectCtx } from "../../lib/project-context";
import type { TicketDetail } from "../../lib/types";

/** Docs/notes that link to this ticket (linking is done from the document). */
export function DocumentsPanel({ t }: { t: TicketDetail }) {
  const { project } = useProjectCtx();
  const { data = [] } = useQuery({ queryKey: ["tp", "ticketdocs", t.id], queryFn: () => get<any[]>(`/tickets/${t.id}/documents`) });
  if (!data.length) return null;
  return (
    <Section title="Documents" count={data.length}>
      {data.map((d) => <Link key={d.id} to={`/p/${project.key}/docs/${d.id}`} className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-stone">{d.kind === "note" ? <StickyNote className="size-4 text-ink-muted" /> : <FileText className="size-4 text-ink-muted" />}{d.title}</Link>)}
    </Section>
  );
}
