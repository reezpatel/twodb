import QRCode from "qrcode";

/**
 * QR → SVG path string, synchronously. Rendering 1000 labels via data URLs
 * would be slow and blurry; a single `<path>` per code is crisp at any print
 * DPI and instant to build.
 */
const memo = new Map<string, { size: number; d: string }>();

export function qrPath(text: string, ecl: "L" | "M" | "Q" | "H" = "M"): { size: number; d: string } {
  const key = ecl + text;
  const hit = memo.get(key);
  if (hit) return hit;
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
  const { size, data } = qr.modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        const start = x;
        while (x < size && data[y * size + x]) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      } else x++;
    }
  }
  const out = { size, d };
  if (memo.size > 5000) memo.clear();
  memo.set(key, out);
  return out;
}
