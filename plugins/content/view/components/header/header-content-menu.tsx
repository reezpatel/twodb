import {
  ArrowDownNarrowWide,
  ArrowUpWideNarrow,
  MoreHorizontal,
} from "lucide-react";
import { useSection } from "../../provider/section-provider";
import { IconButton, Menu, Segmented } from "@twodb/ui";
import { VIEW_OPTIONS } from "../../notes-old/view-options";
import type { NotesViewMode } from "../../notes-old/types";

export const HeaderContentMenu = () => {
  const { activeViewConfig, setActiveViewConfig } = useSection();

  return (
    <>
      <Menu
        placement="bottom-end"
        trigger={
          <IconButton
            className="shell__barbtn"
            icon={<MoreHorizontal size={14} />}
            label="More actions"
            size="sm"
          />
        }
      >
        <div className="shell__viewmenu">
          <Segmented
            aria-label="Choose notes view"
            iconOnly
            items={VIEW_OPTIONS}
            value={activeViewConfig.type}
            onValueChange={(mode) =>
              setActiveViewConfig({
                ...activeViewConfig,
                type: mode as NotesViewMode,
              })
            }
          />
        </div>
      </Menu>
      <style jsx>{`
        .shell__viewmenu {
          display: grid;
          padding: 3px;
        }

        .shell__viewmenu :global(.tw-seg) {
          border-color: var(--line);
        }

        .shell__viewmenu :global(.tw-seg__btn) {
          width: 29px;
          height: 27px;
        }
      `}</style>
    </>
  );
};
