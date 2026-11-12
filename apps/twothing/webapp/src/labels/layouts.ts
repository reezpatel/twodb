/**
 * Physical label stocks. All measurements in mm. Sheet layouts place
 * `cols × rows` labels per page; roll layouts are one label per page (thermal
 * printers treat each label as a page — set the driver's paper to match).
 */
export interface LabelLayout {
  id: string;
  name: string;
  group: "Sheets" | "Rolls";
  pageW: number;
  pageH: number;
  labelW: number;
  labelH: number;
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
}

const roll = (id: string, name: string, w: number, h: number): LabelLayout => ({ id, name, group: "Rolls", pageW: w, pageH: h, labelW: w, labelH: h, cols: 1, rows: 1, marginTop: 0, marginLeft: 0, gapX: 0, gapY: 0 });

export const LAYOUTS: LabelLayout[] = [
  { id: "a4-5x13", name: "A4 · 65 per sheet · 38×21 mm (Avery L7651)", group: "Sheets", pageW: 210, pageH: 297, labelW: 38.1, labelH: 21.2, cols: 5, rows: 13, marginTop: 10.7, marginLeft: 4.75, gapX: 2.5, gapY: 0 },
  { id: "a4-4x10", name: "A4 · 40 per sheet · 48.5×25.4 mm", group: "Sheets", pageW: 210, pageH: 297, labelW: 48.5, labelH: 25.4, cols: 4, rows: 10, marginTop: 21.5, marginLeft: 8, gapX: 0, gapY: 0 },
  { id: "a4-3x8", name: "A4 · 24 per sheet · 70×37 mm", group: "Sheets", pageW: 210, pageH: 297, labelW: 70, labelH: 37, cols: 3, rows: 8, marginTop: 0.5, marginLeft: 0, gapX: 0, gapY: 0 },
  { id: "a4-2x7", name: "A4 · 14 per sheet · 99×38 mm (boxes)", group: "Sheets", pageW: 210, pageH: 297, labelW: 99.1, labelH: 38.1, cols: 2, rows: 7, marginTop: 15.1, marginLeft: 4.65, gapX: 2.5, gapY: 0 },
  { id: "letter-3x10", name: "US Letter · 30 per sheet · 2⅝×1 in (Avery 5160)", group: "Sheets", pageW: 215.9, pageH: 279.4, labelW: 66.675, labelH: 25.4, cols: 3, rows: 10, marginTop: 12.7, marginLeft: 4.76, gapX: 3.175, gapY: 0 },
  roll("roll-50x25", "Roll · 50×25 mm", 50, 25),
  roll("roll-40x30", "Roll · 40×30 mm", 40, 30),
  roll("roll-30x20", "Roll · 30×20 mm", 30, 20),
  roll("roll-25x25", "Roll · 25×25 mm (tiny parts)", 25, 25),
  roll("brother-62x29", "Brother QL · 62×29 mm (DK-11209)", 62, 29),
];

export const layoutById = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
export const perPage = (l: LabelLayout) => l.cols * l.rows;

export interface LabelSpec {
  /** Canonical code (QR payload source). */
  code: string;
  display: string;
  title?: string;
  subtitle?: string;
}

export interface PrintOptions {
  layoutId: string;
  /** "code" = bare code (smallest QR, best for tiny labels); "link" = deep link phone cameras open. */
  qr: "code" | "link";
  /** Skip this many positions on the first sheet (re-use a partly used sheet). */
  offset: number;
  showText: boolean;
  /** Print each label N times (e.g. both ends of a box). */
  copies: number;
}

export const DEFAULT_PRINT: PrintOptions = { layoutId: "a4-5x13", qr: "code", offset: 0, showText: true, copies: 1 };
