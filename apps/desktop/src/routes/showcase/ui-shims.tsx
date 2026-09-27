import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Avatar as UiAvatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Button as UiButton } from "@/components/ui/button";
import { Checkbox as UiCheckbox } from "@/components/ui/checkbox";
import { Dialog as UiDialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input as UiInput } from "@/components/ui/input";
import { Progress as UiProgress } from "@/components/ui/progress";
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch as UiSwitch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs as UiTabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Old @twodb/ui component APIs re-implemented on shadcn/ui + Tailwind so the
 * ui-library showcases run unmodified inside the desktop app's dark theme.
 */

type BtnVariant = React.ComponentProps<typeof UiButton>["variant"];
type BadgeVariant = React.ComponentProps<typeof UiBadge>["variant"];

const BTN_VARIANT: Record<string, BtnVariant> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
  destructive: "destructive",
  outline: "outline",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ComponentProps<"button"> & { variant?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  return (
    <UiButton variant={BTN_VARIANT[variant] ?? "default"} size={size === "md" ? "default" : size} className={className} {...rest}>
      {children}
    </UiButton>
  );
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  className,
  ...rest
}: React.ComponentProps<"button"> & { icon: ReactNode; label: string; size?: "sm" | "md"; variant?: string }) {
  return (
    <UiButton
      variant={BTN_VARIANT[variant] ?? "ghost"}
      size={size === "sm" ? "icon-sm" : "icon"}
      aria-label={label}
      title={label}
      className={className}
      {...rest}
    >
      {icon}
    </UiButton>
  );
}

const TONE_VARIANT: Record<string, BadgeVariant | "rose"> = {
  cobalt: "default",
  go: "success",
  warning: "warning",
  danger: "destructive",
  rose: "rose",
  neutral: "secondary",
};

export function Badge({ tone = "cobalt", size = "md", className, children }: { tone?: string; size?: "sm" | "md"; className?: string; children: ReactNode }) {
  const mapped = TONE_VARIANT[tone] ?? "default";
  return (
    <UiBadge
      variant={mapped === "rose" ? "outline" : mapped}
      className={cn(mapped === "rose" && "border-magenta-400/30 bg-magenta-400/15 text-magenta-300", size === "sm" && "px-1.5 text-[10px]", className)}
    >
      {children}
    </UiBadge>
  );
}

const AVATAR_SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <UiAvatar className={cn(AVATAR_SIZES[size], className)}>
      <AvatarFallback>{initials}</AvatarFallback>
    </UiAvatar>
  );
}

export function Input(props: React.ComponentProps<"input">) {
  return <UiInput {...props} />;
}

export function PasswordInput(props: React.ComponentProps<"input">) {
  return <UiInput type="password" {...props} />;
}

export function Textarea(props: React.ComponentProps<"textarea">) {
  return <UiTextarea {...props} />;
}

export function SearchInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <UiInput className="h-8 pl-8 text-sm" {...props} />
    </div>
  );
}

export function Switch({
  checked,
  defaultChecked,
  onChange,
  ...rest
}: Omit<React.ComponentProps<"button">, "onChange" | "checked"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
}) {
  const handle = (next: boolean) => onChange?.({ target: { checked: next } });
  return <UiSwitch checked={checked ?? defaultChecked} onCheckedChange={handle} {...rest} />;
}

export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  ...rest
}: Omit<React.ComponentProps<"button">, "onChange" | "checked"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
  label?: ReactNode;
}) {
  const box = <UiCheckbox checked={checked ?? defaultChecked} onCheckedChange={(next) => onChange?.({ target: { checked: next === true } })} {...rest} />;
  if (!label) return box;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      {box}
      {label}
    </label>
  );
}

export function Radio({ checked, onChange, label }: { checked?: boolean; onChange?: (event: { target: { checked: boolean } }) => void; label?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        checked={checked}
        onChange={(e) => onChange?.({ target: { checked: e.target.checked } })}
        className="border-input accent-primary size-4"
      />
      {label}
    </label>
  );
}

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return <UiProgress value={value} className={className} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-mono text-[11px]">
      {children}
    </kbd>
  );
}

export function Tooltip$({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
export { Tooltip$ as Tooltip };

export function Menu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuItem({
  icon,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <DropdownMenuItem variant={danger ? "destructive" : undefined} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </DropdownMenuItem>
  );
}

export function MenuDivider() {
  return <DropdownMenuSeparator />;
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  ...rest
}: {
  options: { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
} & Omit<React.ComponentProps<"button">, "value" | "onValueChange">) {
  return (
    <UiSelect value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-sm", className)} {...rest}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  );
}

export function Tabs({ items, value, onValueChange }: { items: { id: string; label: string }[]; value: string; onValueChange: (value: string) => void }) {
  return (
    <UiTabs value={value} onValueChange={onValueChange}>
      <TabsList>
        {items.map((i) => (
          <TabsTrigger key={i.id} value={i.id}>
            {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </UiTabs>
  );
}

export function Segmented({ items, value, onValueChange }: { items: { id: string; label: string }[]; value: string; onValueChange: (value: string) => void }) {
  return <Tabs items={items} value={value} onValueChange={onValueChange} />;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <UiDialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : null}
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </UiDialog>
  );
}

export function QRCode({ value = "twodb", className }: { value?: string; className?: string }) {
  const cells = 11;
  let seed = 0;
  for (const ch of value) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = (i: number) => {
    const x = Math.sin(seed + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const rects: ReactNode[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const finder = (x < 3 && y < 3) || (x >= cells - 3 && y < 3) || (x < 3 && y >= cells - 3);
      const on = finder ? (x === 1 && y === 1) || (x % 3 === 0 && y % 3 === 0) : rand(y * cells + x) > 0.55;
      if (on) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className={cn("bg-background size-24 rounded-md", className)} fill="currentColor" aria-label="QR code">
      {rects}
    </svg>
  );
}

export function CodeInput({ length = 6, onChange }: { length?: number; onChange?: (code: string) => void }) {
  const [values, setValues] = useState<string[]>(Array.from({ length }, () => ""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    onChange?.(values.join(""));
  }, [values, onChange]);

  return (
    <div className="flex gap-2">
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={v}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          className="border-input bg-background focus:ring-ring/20 size-11 rounded-md border text-center text-lg focus:outline-none focus:ring-2"
          onChange={(e) => {
            const next = [...values];
            next[i] = e.target.value.replace(/\D/g, "").slice(-1);
            setValues(next);
            if (next[i] && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !values[i] && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

export function NavRail({
  value,
  onValueChange,
  children,
  ...rest
}: { value: string; onValueChange: (value: string) => void; children: ReactNode } & React.ComponentProps<"nav">) {
  return (
    <nav className="bg-card/40 flex w-14 flex-col items-center gap-1 border-r py-2" {...rest}>
      {Array.isArray(children)
        ? children.map((child) => {
            if (child && typeof child === "object" && "props" in child) {
              const childProps = (child as { props: { value?: string } }).props;
              if (childProps.value) {
                return {
                  ...child,
                  props: { ...childProps, active: childProps.value === value, onSelect: () => onValueChange(childProps.value!) },
                };
              }
            }
            return child;
          })
        : children}
    </nav>
  );
}

export function NavPanelGroup({ children, ...rest }: React.ComponentProps<"div">) {
  return (
    <div className="flex flex-col gap-0.5" {...rest}>
      {children}
    </div>
  );
}

export function NavPanelItem({
  icon,
  label,
  active,
  meta,
  onSelect,
}: {
  icon?: ReactNode;
  label: ReactNode;
  active?: boolean;
  meta?: ReactNode;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "hover:bg-accent/50 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="flex-1 truncate text-left">{label}</span>
      {meta}
    </button>
  );
}

export function SettingGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <header className="border-b px-4 py-3 text-sm font-semibold">{title}</header>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function SettingRow({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description ? <div className="text-muted-foreground text-xs">{description}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function TimePicker({ value, onValueChange }: { value?: string; onValueChange?: (value: string) => void }) {
  const [time, setTime] = useState(value ?? "09:00");
  const change = (next: string) => {
    setTime(next);
    onValueChange?.(next);
  };
  return <UiInput type="time" value={time} onChange={(e) => change(e.target.value)} className="h-8 w-28 text-sm" />;
}

// --- DataTable (old DataColumn API on shadcn Table) --------------------------

export interface DataColumn<T> {
  id: string;
  label: ReactNode;
  width?: number;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  searchPlaceholder,
  pageSize = 10,
  emptyMessage = "No results.",
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);

  const filtered = query && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(query.toLowerCase())) : rows;
  const sorted = sortId
    ? [...filtered].sort((a, b) => {
        const col = columns.find((c) => c.id === sortId);
        if (!col?.sortValue) return 0;
        const av = col.sortValue(a);
        const bv = col.sortValue(b);
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return asc ? cmp : -cmp;
      })
    : filtered;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const view = sorted.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {searchText ? <SearchInput placeholder={searchPlaceholder ?? "Search…"} value={query} onChange={(e) => setQuery(e.target.value)} /> : null}
      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.id} style={c.width ? { width: c.width } : undefined}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="hover:text-foreground inline-flex items-center gap-1"
                      onClick={() => {
                        if (sortId === c.id) setAsc(!asc);
                        else {
                          setSortId(c.id);
                          setAsc(true);
                        }
                      }}
                    >
                      {c.label}
                      <ChevronDown size={12} className={cn("transition-transform", sortId === c.id && !asc && "rotate-180", sortId !== c.id && "opacity-30")} />
                    </button>
                  ) : (
                    c.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground py-8 text-center text-sm">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              view.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((c) => (
                    <TableCell key={c.id}>{c.cell(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pages > 1 ? (
        <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Prev
          </Button>
          <span className="tabular-nums">
            {current + 1} / {pages}
          </span>
          <Button variant="outline" size="xs" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
