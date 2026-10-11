import type { ReactNode } from "react";
import { Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidAddress, useAddressInput, type Address, type AddressScope } from "./use-address-input";

export type { Address, AddressScope } from "./use-address-input";
export { parseAddresses, isValidAddress } from "./use-address-input";

interface AddressInputProps {
  id: string;
  value: Address[];
  onChange: (v: Address[]) => void;
  scope: AddressScope;
  placeholder?: string;
  /** Extra controls rendered inside each chip (e.g. optional-guest toggle). */
  chipExtra?: (a: Address) => ReactNode;
  className?: string;
}

/** Chip input for email recipients and event guests, with suggestions from one contact book. */
export function AddressInput({ id, value, onChange, scope, placeholder, chipExtra, className }: AddressInputProps) {
  const a = useAddressInput(value, onChange, scope);

  return (
    <div className={cn("relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5", className)}>
      {value.map((v) => (
        <span
          key={v.address}
          title={v.address}
          className={cn(
            "bg-muted/50 inline-flex h-7 max-w-64 items-center gap-1 rounded-full border px-2.5 text-xs",
            !isValidAddress(v.address) && "border-destructive text-destructive",
          )}
        >
          <span className="truncate font-medium">{v.name || v.address}</span>
          {chipExtra?.(v)}
          <button type="button" aria-label={`Remove ${v.address}`} className="text-muted-foreground hover:text-foreground" onClick={() => a.remove(v.address)}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={a.text}
        placeholder={value.length ? "" : placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={a.open}
        aria-controls={`${id}-suggestions`}
        onChange={(e) => a.setText(e.target.value)}
        onFocus={() => a.setOpen(true)}
        onBlur={() => {
          setTimeout(() => a.setOpen(false), 150);
          a.commitText();
        }}
        onPaste={a.onPaste}
        onKeyDown={a.onKeyDown}
        className="placeholder:text-muted-foreground h-7 min-w-32 flex-1 bg-transparent text-sm outline-none"
      />
      {a.open ? (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border p-1 shadow-lg"
        >
          {a.items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === a.highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                a.pick(s);
              }}
              onMouseEnter={() => a.setHighlight(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", i === a.highlight && "bg-accent")}
            >
              <span className="bg-muted grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold uppercase">
                {(s.name || s.email).slice(0, 1)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{s.name || s.email}</span>
                {s.name ? <span className="text-muted-foreground truncate text-xs">{s.email}</span> : null}
              </span>
              {s.orgMember ? <Building2 size={12} className="text-muted-foreground shrink-0" aria-label="Organization member" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
