import type { ComponentProps } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppNav, type AppNavIcon } from "./app-nav-context";

const SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;

export interface AppNavLinkProps extends Omit<ComponentProps<"button">, "id"> {
  /** Unique across the whole nav — it's what selection is keyed on. */
  id: string;
  label: string;
  icon?: AppNavIcon;
  /** Small uppercase tag after the label, e.g. "NEW". */
  badge?: string;
}

/** One selectable link. The hover highlight and the "pill" selection slide between rows. */
export function AppNavLink({ id, label, icon: Icon, badge, disabled, className, onClick, ...props }: AppNavLinkProps) {
  const { selectedId, hoveredId, variant, activeColor, onSelect, onHover } = useAppNav();
  const selected = selectedId === id;
  const hovered = hoveredId === id;

  return (
    <button
      type="button"
      data-slot="app-nav-link"
      aria-current={selected ? "page" : undefined}
      disabled={disabled}
      onClick={(event) => {
        onSelect(id);
        onClick?.(event);
      }}
      onMouseEnter={() => !disabled && onHover(id)}
      className={cn(
        "group focus-visible:ring-ring relative flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 pl-8 text-left text-sm outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        selected ? (variant === "line" ? "text-foreground font-semibold" : "text-foreground font-medium") : "text-muted-foreground font-normal",
        className,
      )}
      {...props}
    >
      {variant === "pill" && selected ? (
        <motion.span layoutId="app-nav-selected" className="bg-secondary pointer-events-none absolute inset-0 z-0 rounded-md" transition={SPRING} />
      ) : null}
      {hovered && (variant === "line" || !selected) ? (
        <motion.span layoutId="app-nav-hover" className="bg-accent/60 pointer-events-none absolute inset-0 z-0 rounded-md" transition={SPRING} />
      ) : null}

      <span className="relative z-10 flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0 transition-colors duration-150",
              selected ? (variant === "line" ? activeColor : "text-foreground") : "text-muted-foreground group-hover:text-foreground",
            )}
          />
        ) : null}
        <span className="group-hover:text-foreground truncate leading-none transition-colors duration-150">{label}</span>
      </span>

      {badge ? (
        <span className="bg-primary/10 text-primary relative z-10 ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
