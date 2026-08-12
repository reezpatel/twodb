import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { fieldStyles } from "./Field.style";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  label,
  hint,
  error,
  name,
  disabled,
  id,
  "aria-label": ariaLabel,
}: SelectProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const labelId = `${baseId}-label`;

  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placeTop, setPlaceTop] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function commit(next: string) {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
    setOpen(false);
  }

  function openList() {
    if (disabled) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const popupHeight = Math.min(240, options.length * 36 + 8);
      setPlaceTop(rect.bottom + 6 + popupHeight > window.innerHeight && rect.top > popupHeight);
    }
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, baseId]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[active]) commit(options[active].value);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const trigger = (
    <div className="tw-select" ref={rootRef}>
      <style jsx>{fieldStyles}</style>
      <button
        type="button"
        id={baseId}
        className="tw-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-activedescendant={open && active >= 0 ? `${baseId}-option-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "tw-select__value" : "tw-select__value tw-select__value--placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="tw-select__chevron" aria-hidden="true" />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {open ? (
        <div
          className={placeTop ? "tw-select__popup tw-select__popup--top" : "tw-select__popup"}
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
        >
          {options.map((option, i) => {
            const isSelected = option.value === current;
            const classes = [
              "tw-select__option",
              isSelected ? "tw-select__option--selected" : "",
              i === active ? "tw-select__option--active" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={option.value}
                id={`${baseId}-option-${i}`}
                role="option"
                aria-selected={isSelected}
                className={classes}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(option.value)}
              >
                <span>{option.label}</span>
                {isSelected ? <Check aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  if (!label && !hint && !error) return trigger;

  return (
    <div className="tw-field">
      <style jsx>{fieldStyles}</style>
      {label ? (
        <span className="tw-field__label" id={labelId}>
          {label}
        </span>
      ) : null}
      {trigger}
      {error ? (
        <span className="tw-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="tw-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
