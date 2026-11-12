import { ChevronRight, Copy, Maximize, MoreHorizontal, PanelLeftOpen, Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import type { RecordDetail } from "@shared/model";
import { useGarden } from "../../lib/queries";
import { Popover } from "../../ui/Popover";
import { IconButton } from "../../ui/IconButton";
import { MenuButton, MenuSeparator } from "../../ui/MenuButton";
import { RecordIcon } from "../../ui/RecordIcon";
import { useShell } from "../ShellContext";

/** Top bar: breadcrumbs (collapsed in the middle when deep) + favorite + page menu. */
export function HeaderBar({ record, title }: { record?: RecordDetail; title?: string }) {
  const navigate = useNavigate();
  const garden = useGarden();
  const shell = useShell();
  const chain = record ? [...record.ancestors, { id: record.id, kind: record.kind, title: record.title, icon: record.icon }] : [];
  const crumbs = chain.length > 4 ? [chain[0], null, ...chain.slice(-2)] : chain;
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 px-3">
      {shell.collapsed ? (
        <IconButton title="Open sidebar" onClick={shell.expand}>
          <PanelLeftOpen size={16} />
        </IconButton>
      ) : null}
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-[13.5px]">
        {title ? <span className="px-1 font-medium">{title}</span> : null}
        {crumbs.map((c, i) => (
          <span key={c?.id ?? `gap-${i}`} className="flex min-w-0 items-center gap-0.5">
            {i > 0 ? <ChevronRight size={13} className="shrink-0 text-ink-muted/60" /> : null}
            {c ? (
              <button
                type="button"
                onClick={() => navigate(`/${c.id}`)}
                className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-ink/[0.05] ${i === crumbs.length - 1 ? "text-ink" : "text-ink-muted"}`}
              >
                <RecordIcon icon={c.icon} kind={c.kind} size={14} />
                <span className="max-w-[200px] truncate">{c.title || "Untitled"}</span>
              </button>
            ) : (
              <span className="px-1 text-ink-muted">…</span>
            )}
          </span>
        ))}
      </nav>
      {record && !record.deletedAt && !record.isDefaultDatabase ? (
        <>
          <IconButton title={record.isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => void garden.patchRecord(record.id, { isFavorite: !record.isFavorite })}>
            <Star size={16} className={record.isFavorite ? "fill-glow text-warning" : undefined} />
          </IconButton>
          <Popover
            align="end"
            trigger={
              <IconButton title="More">
                <MoreHorizontal size={16} />
              </IconButton>
            }
          >
            <div className="w-[220px] p-1">
              {record.kind === "page" ? (
                <MenuButton icon={<Maximize size={14} />} trailing={record.config.fullWidth ? "On" : "Off"} onClick={() => void garden.patchRecord(record.id, { config: { fullWidth: !record.config.fullWidth } })}>
                  Full width
                </MenuButton>
              ) : null}
              <MenuButton icon={<Copy size={14} />} onClick={() => void navigator.clipboard.writeText(location.href.split("?")[0])}>
                Copy link
              </MenuButton>
              <MenuSeparator />
              <MenuButton danger icon={<Trash2 size={14} />} onClick={() => void garden.trash(record.id).then(() => navigate(record.parentId ? `/${record.parentId}` : "/all"))}>
                Move to trash
              </MenuButton>
              <div className="px-2 pb-1 pt-2 text-[11px] text-ink-muted">Edited {new Date(record.updatedAt).toLocaleString()}</div>
            </div>
          </Popover>
        </>
      ) : null}
    </header>
  );
}
