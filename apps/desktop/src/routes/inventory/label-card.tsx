import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { LabelData } from "./inventory-api";

export interface LabelSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  sheet: boolean;
}

export const LABEL_SIZES: LabelSize[] = [
  { id: "small", name: "Roll · 50 × 25 mm", widthMm: 50, heightMm: 25, columns: 1, sheet: false },
  { id: "medium", name: "Roll · 100 × 50 mm", widthMm: 100, heightMm: 50, columns: 1, sheet: false },
  { id: "a4", name: "A4 sheet · 3 × 8 (70 × 37 mm)", widthMm: 70, heightMm: 37, columns: 3, sheet: true },
];

function useQr(text: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(text, { margin: 0, errorCorrectionLevel: "M", width: 256 }).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [text]);
  return url;
}

export function LabelCard({ label, size, kind }: { label: LabelData; size: LabelSize; kind: "item" | "location" }) {
  const svg = useRef<SVGSVGElement>(null);
  const qr = useQr(label.code);
  const pad = size.heightMm <= 25 ? 1.5 : 2.5;
  const qrMm = Math.min(size.heightMm - pad * 2, size.widthMm * 0.4);
  const compact = size.heightMm <= 25;

  useEffect(() => {
    if (!svg.current) return;
    JsBarcode(svg.current, label.code, { format: "CODE128", displayValue: false, margin: 0, height: 40, width: 2 });
  }, [label.code]);

  return (
    <div
      className="label-card flex overflow-hidden bg-white text-black"
      style={{ width: `${size.widthMm}mm`, height: `${size.heightMm}mm`, padding: `${pad}mm`, gap: `${pad}mm`, boxSizing: "border-box", breakInside: "avoid" }}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="line-clamp-2 leading-tight font-bold" style={{ fontSize: `${compact ? 2.8 : kind === "location" ? 5 : 3.6}mm` }}>
            {label.title || "Untitled"}
          </p>
          {label.subtitle ? (
            <p className="line-clamp-2 leading-tight text-neutral-600" style={{ fontSize: `${compact ? 2 : 2.7}mm` }}>
              {label.subtitle}
            </p>
          ) : null}
        </div>
        <div>
          <svg ref={svg} preserveAspectRatio="none" style={{ width: "100%", height: `${compact ? 7 : 10}mm`, display: "block" }} />
          <p className="font-mono leading-none" style={{ fontSize: `${compact ? 2.2 : 2.8}mm` }}>
            {label.display}
          </p>
        </div>
      </div>
      {qr ? <img src={qr} alt="" style={{ width: `${qrMm}mm`, height: `${qrMm}mm`, alignSelf: "center" }} /> : null}
    </div>
  );
}
