import { useEffect, useRef } from "react";

/**
 * USB / Bluetooth barcode scanners act as keyboards ("wedge" mode): they type
 * the code very fast and press Enter. When focus is NOT in a text field, we
 * buffer keystrokes that arrive < 40 ms apart and treat "≥4 chars + Enter" as
 * a scan. (Inside a field the scanner simply types into it — every scan field
 * submits on Enter.)
 */
export function useWedgeScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let last = 0;
    const editable = (el: Element | null) =>
      !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);
    const onKey = (e: KeyboardEvent) => {
      if (editable(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 40) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 4) {
          e.preventDefault();
          cb.current(buf);
        }
        buf = "";
      } else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
