import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import type { CellType } from "./cells";
import { Button } from "./Button";
import { Divider } from "./Divider";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Select } from "./Select";
import { Switch } from "./Switch";
import { Textarea } from "./Textarea";

const TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "select", label: "Single select" },
  { value: "multiselect", label: "Multi select" },
  { value: "chips", label: "Chips" },
  { value: "url", label: "URL" },
  { value: "file", label: "File" },
  { value: "progress", label: "Progress" },
  { value: "stars", label: "Rating" },
];

/**
 * Column configuration panel — rename, datatype, formatting.
 * Currently presentational: controls are real, but changes are not
 * wired back into the table (mock, per product decision).
 */
export function ColumnConfig({ label, type }: { label: string; type: CellType }) {
  const [open, setOpen] = useState(false);
  const [dataType, setDataType] = useState<CellType>(type);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const panel = panelRef.current;
    const w = 264;
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 16))}px`;
    /* clamp against the real box — the anchor may sit past the scroll edge */
    const measured = panel.getBoundingClientRect();
    if (measured.right > window.innerWidth - 8) {
      panel.style.left = `${Math.max(8, window.innerWidth - measured.width - 8)}px`;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="tw-colconfig-anchor" ref={anchorRef}>
      <IconButton
        size="sm"
        className="tw-col-config"
        label={`${label} column settings`}
        icon={<Settings2 />}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open
        ? createPortal(
            <div className="tw-colconfig" ref={panelRef} role="dialog" aria-label={`${label} column settings`}>
          <Input label="Name" defaultValue={label} />
          <Select
            label="Data type"
            value={dataType}
            onValueChange={(v) => setDataType(v as CellType)}
            options={TYPE_OPTIONS}
          />

          {dataType === "currency" || dataType === "number" ? (
            <>
              <Select
                label="Format"
                defaultValue="inr"
                options={[
                  { value: "inr", label: "₹ INR" },
                  { value: "usd", label: "$ USD" },
                  { value: "eur", label: "€ EUR" },
                ]}
              />
              <Select
                label="Decimals"
                defaultValue="0"
                options={[
                  { value: "0", label: "0" },
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                ]}
              />
            </>
          ) : null}

          {dataType === "select" || dataType === "multiselect" || dataType === "chips" ? (
            <Textarea label="Options (one per line)" placeholder={"Paid\nDue\nOverdue"} />
          ) : null}

          {dataType === "progress" ? (
            <Select
              label="Show as"
              defaultValue="bar"
              options={[
                { value: "bar", label: "Bar" },
                { value: "percent", label: "Percentage" },
              ]}
            />
          ) : null}

          <Divider />
          <Switch label="Visible in table" defaultChecked />
          <Switch label="Sortable" defaultChecked />
          <Divider />
          <Button variant="danger" size="sm">
            Delete column
          </Button>
        </div>,
            document.body
          )
        : null}
    </span>
  );
}
