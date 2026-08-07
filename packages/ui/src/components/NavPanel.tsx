import type { ReactNode } from "react";

export interface NavPanelProps {
  /** Slot rendered above the sections — usually a SearchInput. */
  search?: ReactNode;
  children: ReactNode;
  /** Slot pinned to the bottom — secondary links, AccountMenu. */
  footer?: ReactNode;
}

export function NavPanel({ search, children, footer }: NavPanelProps) {
  return (
    <div className="tw-panel">
      {search ? <div className="tw-panel__search">{search}</div> : null}
      <div className="tw-panel__body">{children}</div>
      {footer ? <div className="tw-panel__footer">{footer}</div> : null}
    </div>
  );
}

export interface NavSectionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface NavSectionProps {
  label?: string;
  items: NavSectionItem[];
  value?: string;
  onValueChange?: (id: string) => void;
}

export function NavSection({ label, items, value, onValueChange }: NavSectionProps) {
  return (
    <div className="tw-navsec">
      {label ? <span className="tw-navsec__label">{label}</span> : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === value ? "tw-navlink tw-navlink--active" : "tw-navlink"}
          aria-current={item.id === value ? "page" : undefined}
          onClick={() => onValueChange?.(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge ? <span className="tw-navlink__badge">{item.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
