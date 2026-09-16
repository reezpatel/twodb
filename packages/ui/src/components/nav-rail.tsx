import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";
import { navRailStyles } from "./nav-rail.style";

const appLogo = new URL("../assets/twodb-mark.png", import.meta.url).href;

export interface NavRailItem {
  id: string;
  icon: ReactNode;
  label: string;
}

export interface NavRailProps {
  items: NavRailItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Optional custom mark rendered inside the home link. */
  header?: ReactNode;
  /** Home destination for the clickable app mark. */
  homeHref?: string;
  /** Accessible name for the home link. */
  homeLabel?: string;
  /** Slot pinned below the items — e.g. a phase toggle. */
  footer?: ReactNode;
  "aria-label"?: string;
}

export function NavRail({
  items,
  value,
  onValueChange,
  header,
  homeHref = "/",
  homeLabel = "Go to home",
  footer,
  "aria-label": ariaLabel = "Primary",
}: NavRailProps) {
  return (
    <nav className="tw-rail" aria-label={ariaLabel}>
      <style jsx>{navRailStyles}</style>
      <a className="tw-rail__home" href={homeHref} aria-label={homeLabel}>
        {header ?? (
          <img
            className="tw-rail__logo"
            src={appLogo}
            alt=""
            width={28}
            height={28}
          />
        )}
      </a>
      {items.map((item) => (
        <Tooltip key={item.id} tip={item.label} side="right" delay={3000}>
          <button
            type="button"
            className={
              item.id === value
                ? "tw-rail__item tw-rail__item--active"
                : "tw-rail__item"
            }
            aria-label={item.label}
            aria-current={item.id === value ? "page" : undefined}
            onClick={() => onValueChange(item.id)}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
      {footer ? (
        <>
          <span className="tw-rail__spacer" />
          {footer}
        </>
      ) : null}
    </nav>
  );
}
