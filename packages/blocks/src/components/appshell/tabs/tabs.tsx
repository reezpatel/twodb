import * as React from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP_TONES, type ChipTone } from "../../ui/chip/chip";

/** Represents a single tab. `value` is the Radix tab value; `label` is shown on the tab itself. */
export type TabData = {
  value: string;
  label: string;
  icon?: React.ElementType;
  attention?: ChipTone;
};

export interface TabsProps extends Omit<React.ComponentProps<"div">, "onChange" | "children"> {
  tabs: TabData[];
  activeValue: string;
  onChange?: (value: string) => void;
  /** Called when the user closes a tab via the ✕ button, middle-click, or context menu. */
  onClose?: (value: string) => void;
  /** Called when the user reorders tabs by dragging. */
  onReorder?: (tabs: TabData[]) => void;
  /** Called when the user clicks the "+" button. */
  onAdd?: () => void;
  /** Render the content for the currently-active tab. */
  children: React.ReactNode | ((activeValue: string) => React.ReactNode);
}

/**
 * Chrome-like tab strip. Drag-to-reorder, close on middle-click or the ✕ button,
 * a right-click context menu (Close / Close others / Close to left/right), and a "+"
 * button for a new tab. Active tab gets an inverted-radius corner blending into the
 * content pane below.
 */
function Tabs({ tabs, activeValue, onChange, onClose, onReorder, onAdd, className, children, ...props }: TabsProps) {
  const activeIndex = tabs.findIndex((t) => t.value === activeValue);
  const activeTab = tabs[activeIndex];
  const canClose = tabs.length > 1;

  return (
    <div data-slot="tabs" className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-paper", className)} {...props}>
      <div className="flex items-end bg-stone pt-2">
        <div className="scrollbar-hide flex flex-1 items-end overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <Reorder.Group
            as="ol"
            axis="x"
            values={tabs}
            onReorder={(next: TabData[]) => onReorder?.(next)}
            className="flex items-end"
            role="tablist"
          >
            <AnimatePresence initial={false}>
              {tabs.map((tab, index) => {
                const isActive = tab.value === activeValue;
                const hasRightNeighborActive = index < tabs.length - 1 && tabs[index + 1].value === activeValue;
                return (
                  <Reorder.Item
                    key={tab.value}
                    value={tab}
                    as="li"
                    layout
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    whileDrag={{ cursor: "grabbing" }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    className="group relative shrink-0"
                    style={{ zIndex: isActive ? 10 : 1 }}
                  >
                    <TabItem
                      tab={tab}
                      isActive={isActive}
                      canClose={canClose}
                      hasRightNeighborActive={hasRightNeighborActive}
                      onClick={() => onChange?.(tab.value)}
                      onClose={() => onClose?.(tab.value)}
                    />
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
          {onAdd ? (
            <motion.button
              layout
              type="button"
              onClick={onAdd}
              data-slot="tabs-add"
              aria-label="New tab"
              className="mb-0.5 ml-1 flex size-8 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink focus-visible:outline-2 focus-visible:outline-ion-deep"
            >
              <Plus className="size-4" strokeWidth={1.5} />
            </motion.button>
          ) : null}
        </div>
      </div>
      <div data-slot="tabs-content" className="min-h-0 flex-1 overflow-y-auto bg-paper outline-none">
        {typeof children === "function" ? children(activeTab?.value ?? "") : children}
      </div>
    </div>
  );
}

export interface TabItemProps {
  tab: TabData;
  isActive: boolean;
  canClose: boolean;
  hasRightNeighborActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

function TabItem({ tab, isActive, canClose, hasRightNeighborActive, onClick, onClose }: TabItemProps) {
  const Icon = tab.icon;
  const tabRef = React.useRef<HTMLDivElement>(null);

  // Keep the active tab in view when it changes.
  React.useEffect(() => {
    if (isActive) tabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [isActive]);

  const handleAuxClick = (event: React.MouseEvent) => {
    if (event.button === 1 && canClose) {
      event.preventDefault();
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    } else if ((event.key === "Delete" || event.key === "Backspace") && canClose) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "relative flex min-w-[140px] max-w-[220px] cursor-pointer items-center gap-2 px-4 py-2.5 text-sm outline-none transition-colors duration-150 active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-ion-deep focus-visible:ring-offset-2 focus-visible:ring-offset-stone",
        isActive ? "text-ink" : "text-muted-foreground hover:text-ink",
      )}
      onClick={onClick}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      ref={tabRef}
    >
      {isActive ? (
        <motion.div
          className="absolute inset-0 rounded-t-[10px] bg-paper"
          layoutId="activeTabBg"
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        >
          {/* Left inverted-radius corner */}
          <div className="absolute bottom-0 -left-3 h-3 w-3 overflow-hidden">
            <div className="absolute right-0 bottom-0 h-6 w-6 rounded-full bg-stone" />
            <div className="absolute inset-0 bg-paper" />
          </div>
          {/* Right inverted-radius corner */}
          <div className="absolute bottom-0 -right-3 h-3 w-3 overflow-hidden">
            <div className="absolute bottom-0 left-0 h-6 w-6 rounded-full bg-stone" />
            <div className="absolute inset-0 bg-paper" />
          </div>
        </motion.div>
      ) : null}

      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.5} /> : null}
        <span className="flex-1 truncate font-sans text-[13px] leading-none font-medium select-none">{tab.label}</span>

        <span className="relative flex size-5 shrink-0 items-center justify-center">
          {tab.attention ? (
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 m-auto size-2.5 rounded-full ring-2 transition-opacity",
                isActive ? "ring-paper" : "ring-stone",
                ATTENTION_DOT_CLASS[tab.attention],
                canClose && "group-hover:opacity-0 group-focus-within:opacity-0",
              )}
            />
          ) : null}
          {canClose ? (
            <button
              type="button"
              aria-label="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full transition-opacity",
                isActive ? "text-ink-muted hover:bg-stone hover:text-ink" : "text-muted-foreground opacity-0 hover:bg-paper-grid hover:text-ink group-hover:opacity-100",
              )}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </span>
      </div>

      {!isActive && !hasRightNeighborActive ? (
        <div className="absolute top-1/2 right-0 h-4 w-px -translate-y-1/2 bg-outline" />
      ) : null}
    </div>
  );
}

const ATTENTION_DOT_CLASS: Record<ChipTone, string> = {
  info: "bg-info",
  danger: "bg-destructive",
  success: "bg-success",
  warning: "bg-warning",
};

export { Tabs, CHIP_TONES as TAB_ATTENTION_TONES };
