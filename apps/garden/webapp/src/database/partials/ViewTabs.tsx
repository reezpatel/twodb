import { useState } from "react";
import { Plus } from "lucide-react";
import { VIEW_TYPES } from "@shared/model";
import { cn } from "@twodb/blocks";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { Popover } from "../../ui/Popover";
import { MenuButton, MenuLabel } from "../../ui/MenuButton";
import { IconButton } from "../../ui/IconButton";
import { VIEW_META } from "./viewIcons";

export function ViewTabs({ m }: { m: DatabaseViewModel }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
      {m.views.map((v) => {
        const { Icon } = VIEW_META[v.type];
        const active = v.id === m.view?.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => m.selectView(v.id)}
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13.5px] transition-colors",
              active ? "text-ink after:absolute after:inset-x-2 after:-bottom-[5px] after:h-[2px] after:rounded-full after:bg-ink" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
            )}
          >
            <Icon size={15} strokeWidth={1.7} />
            <span className={cn("max-w-[160px] truncate", active && "font-medium")}>{v.name}</span>
          </button>
        );
      })}
      <Popover
        open={adding}
        onOpenChange={setAdding}
        trigger={
          <IconButton title="Add view" aria-label="Add view">
            <Plus size={15} />
          </IconButton>
        }
      >
        <div className="w-[200px] p-1">
          <MenuLabel>Add a view</MenuLabel>
          {VIEW_TYPES.map((t) => {
            const { Icon, label } = VIEW_META[t];
            return (
              <MenuButton
                key={t}
                icon={<Icon size={15} />}
                onClick={() => {
                  setAdding(false);
                  void m.createView(t, label);
                }}
              >
                {label}
              </MenuButton>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
