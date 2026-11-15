import { useMemo } from "react";
import { useDarkMode } from "./useDarkMode";

/**
 * Concrete colours for canvas internals (SVG fills/strokes, edge markers) that
 * cannot use Tailwind's theme tokens. Dark values mirror blocks/styles.css's
 * dark palette (graphite grounds, lavender-tinted foreground). Light values are
 * the original slate palette, so light mode is pixel-unchanged.
 */
export interface CanvasTheme {
  dark: boolean;
  /** Card surfaces drawn on the canvas (entity body, shape fill default). */
  cardBg: string;
  cardBorder: string;
  shapeFill: string;
  shapeStroke: string;
  shapeText: string;
  subText: string;
  /** Swimlane/pool chrome. */
  laneTitleBg: string;
  poolBorder: string;
  /** Edge stroke per kind. */
  edge: Record<"flow" | "sync" | "async" | "data" | "dep" | "relation", string>;
  /** Selected edge/handle accent. */
  selected: string;
  /** Floating label chip on edges. */
  chipBg: string;
  chipBorder: string;
  chipText: string;
  /** Background of crow's-foot glyph circles. */
  glyphFill: string;
}

const LIGHT: CanvasTheme = {
  dark: false,
  cardBg: "#ffffff",
  cardBorder: "#94a3b8",
  shapeFill: "#ffffff",
  shapeStroke: "#334155",
  shapeText: "#0f172a",
  subText: "#64748b",
  laneTitleBg: "#f8fafc",
  poolBorder: "#475569",
  edge: { flow: "#475569", sync: "#2563eb", async: "#7c3aed", data: "#059669", dep: "#94a3b8", relation: "#334155" },
  selected: "#4f63ad",
  chipBg: "rgba(255,255,255,0.95)",
  chipBorder: "#e2e8f0",
  chipText: "#334155",
  glyphFill: "#ffffff",
};

const DARK: CanvasTheme = {
  dark: true,
  cardBg: "#353535",
  cardBorder: "#565159",
  shapeFill: "#353535",
  shapeStroke: "#a5a0a8",
  shapeText: "#cfcad2",
  subText: "#a5a0a8",
  laneTitleBg: "#262424",
  poolBorder: "#8b8692",
  edge: { flow: "#a5a0a8", sync: "#8ab4f8", async: "#c4b5fd", data: "#34d399", dep: "#6e6a72", relation: "#cfcad2" },
  selected: "#b9a7e6",
  chipBg: "rgba(37,37,37,0.95)",
  chipBorder: "#4a4a4e",
  chipText: "#cfcad2",
  glyphFill: "#353535",
};

/** Business hook: the concrete canvas palette for the current theme. */
export function useCanvasTheme(): CanvasTheme {
  const dark = useDarkMode();
  return useMemo(() => (dark ? DARK : LIGHT), [dark]);
}

/**
 * Brand strokes defined for light backgrounds (e.g. AWS navy #232f3e) vanish on
 * a dark canvas. In dark mode lift them towards the ink colour, keeping hue.
 */
export function visibleStroke(stroke: string, theme: CanvasTheme): string {
  return theme.dark ? `color-mix(in srgb, ${stroke} 55%, #cfcad2)` : stroke;
}
