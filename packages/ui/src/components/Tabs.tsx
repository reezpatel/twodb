import { tabsStyles } from "./Tabs.style";
export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  "aria-label": string;
}

export function Tabs({ items, value, onValueChange, "aria-label": ariaLabel }: TabsProps) {
  return (
    <div className="tw-tabs" role="tablist" aria-label={ariaLabel}>
      <style jsx>{tabsStyles}</style>
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={item.id === value}
          className={item.id === value ? "tw-tab tw-tab--active" : "tw-tab"}
          onClick={() => onValueChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
