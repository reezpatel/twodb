import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Section, addBtn } from "./Section";
import { bytes, timeAgo } from "../../lib/format";
import type { TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

export function AttachmentsPanel({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const up = (files: FileList | File[] | null) => { const f = files ? Array.from(files) : []; if (f.length) api.attachments.upload.mutate(f); };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); up(e.dataTransfer.files); }} className={over ? "rounded-md ring-2 ring-ion-deep" : ""}>
      <Section title="Attachments" count={t.attachments.length} action={<button className={addBtn} onClick={() => input.current?.click()}><Paperclip className="size-3" />Attach</button>}>
        <input ref={input} type="file" multiple hidden onChange={(e) => { up(e.target.files); e.target.value = ""; }} />
        {api.attachments.upload.isPending ? <div className="text-xs text-ink-muted">Uploading…</div> : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {t.attachments.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-md border border-outline bg-card">
              <a href={api.attachments.url(a.id)} target="_blank" rel="noreferrer noopener" className="block">
                {a.contentType.startsWith("image/") ? <img src={api.attachments.url(a.id)} alt={a.fileName} loading="lazy" className="h-24 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-stone"><FileText className="size-7 text-ink-muted" /></div>}
                <div className="truncate px-2 pt-1.5 text-xs font-medium">{a.fileName}</div><div className="px-2 pb-1.5 text-[11px] text-ink-muted">{bytes(a.size)} · {timeAgo(a.createdAt)}</div>
              </a>
              <button aria-label={`Delete ${a.fileName}`} className="absolute top-1 right-1 hidden rounded-full bg-paper/90 p-1 group-hover:block hover:text-destructive" onClick={() => api.attachments.remove.mutate(a.id)}><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
