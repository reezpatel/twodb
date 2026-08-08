---
name: twodb
description: "Cyclorama Dawn — light is the only chrome; state arrives as light, never as glow, shadow, or ornament."
colors:
  night: "#050506"
  cobalt: "#0A2BFF"
  cobalt-deep: "#0A22D6"
  cobalt-soft: "#6D80FF"
  rose: "#D24BFF"
  rose-ink: "#8A1FA8"
  rose-light: "#FF7BAE"
  dawn: "#FFD7E6"
  day: "#FFFFFF"
  ink: "#121218"
  ink-2: "#40404E"
  ink-3: "#626274"
  line: "#E6E4EC"
  line-strong: "#CFCDD9"
  band: "#FAF9FC"
  band-strong: "#F2F0F7"
  action: "#0A2BFF"
  warning-ink: "#7A5200"
  warning-bg: "#F8EED7"
  danger-ink: "#9D1B4F"
  danger-bg: "#FCE3EC"
typography:
  display:
    fontFamily: "Oswald, Public Sans, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16.5px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Oswald, Public Sans, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
  space-8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.day}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 14px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.day}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.day}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-go:
    backgroundColor: "rgb(10 43 255 / 0.08)"
    textColor: "{colors.cobalt}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2.5px 10px"
---

# Design System: twodb

## Overview

**Creative North Star: "Cyclorama Dawn"**

twodb's interface is a stage at first light. Surfaces are a horizon — quiet matte bands bounded by hairline rules — and every state change arrives as light rising: cobalt for structure and action, rose for the AI's presence. Light is the only chrome. The system refuses the category's gray-cards-and-drop-shadows default: no gradient fills on controls, no glow, no colored shadows, no ornamental decoration. Depth is tonal, not dimensional.

The world runs in two phases. **Day** is the default working surface: a light gray ground (`#F5F5F7`, user-pinned 2026-08-08) with white surfaces floating on it, near-black ink, hairline rules. **Night** is depthless black (`#050506`), switched by setting `[data-phase="night"]` on any subtree — the same token names resolve to night values, so components are written once against semantic tokens (`--bg`, `--ink`, `--line`, `--accent`, `--action`) and never against raw palette values. The palette itself is a single sweep of light: night → cobalt → rose → rose-light → dawn → day. Color is never decoration; it is the phase a surface is in.

Density is calm and slightly condensed, with deliberate negative space — a PRODUCT.md brand commitment. Type pairs Public Sans (UI text) with Oswald tracked caps (the "cue register": labels, section markers, wordmark). Motion is a single exponential ease-out — light rises, never bounces — with one authored "cue-up" entrance (bands rise in sequence, 45ms stagger) and `prefers-reduced-motion` honored everywhere. A fine fractal-noise grain sits over large fields at low opacity for a matte tooth, never glossy.

**Tech decision (durable):** tokens are pure CSS custom properties plus plain component CSS — no Tailwind, no CSS-in-JS. `packages/ui` is consumed as source by multiple Vite apps, and derived component packages need a stable, framework-free token contract (`--tw-*` semantic custom properties, day/night resolved via `[data-phase]`). Fonts are self-hosted via `@fontsource` (Public Sans 400/500/600/700, Oswald 500/600).

**Key Characteristics:**

- Two phases (day default / night via `[data-phase="night"]`), one semantic token set.
- One lit control per view: only the primary action carries solid color (flat cobalt).
- Elevation = hairline borders + tonal bands; the dialog overlay carries the only real shadow.
- Cue register: Oswald tracked caps for labels; tabular numerals for data.
- Fine grain (0.06 day multiply / 0.08 night screen) over large fields — matte, never glossy.
- The cobalt→rose sweep (`--wash`) is identity material only: the Horizon foundation piece and future brand moments.

## Colors

The palette is one sweep of light along a horizon, from depthless night to full day; cobalt and rose are the two working lights.

### Primary

- **Cobalt Horizon** (#0A2BFF): the structural and action light. Solid fill of primary buttons and switches (day), focus rings, active tab rules, links/accents. On night it softens to **Cobalt Soft** (#6D80FF) for legibility, and the solid action fill brightens to #3A55FF.
- **Cobalt Deep** (#0A22D6): hover state of the solid action (day).

### Secondary

- **Rose Gather** (#D24BFF): the AI's light — reserved for AI presence, suggestions, and AI-generated content. Never used for ordinary actions. Deepened to **Rose Ink** (#8A1FA8) for rose text on day; softened to **Rose Light** (#FF7BAE) on night.

### Tertiary

- **Dawn Wash** (#FFD7E6): selection highlight on day; the tint behind warning semantics. A warming color, not a working one.
- **Warning** (#7A5200 ink on #F8EED7 bg, day): dawn-tinted caution.
- **Danger** (#9D1B4F ink on #FCE3EC bg, day): deepened rose for destructive/invalid states.

### Neutral

- **Depthless Night** (#050506): night-phase ground; also tooltips and code surfaces in day phase.
- **Soft Gray Ground** (#F5F5F7): day-phase backdrop; surfaces stay white above it.
- **Full Day** (#FFFFFF): day-phase surfaces and cards.
- **Tonal bands** (#FAF9FC, #F2F0F7): quiet banding for secondary surfaces, hover fills, skeletons (night: #0B0B11, #13131C).
- **Ink** (#121218 / #40404E / #626274): three-step text ramp — primary, secondary, muted (night: #F4F3F8 / #C4C3D1 / #9291A3).
- **Hairlines** (#E6E4EC, #CFCDD9): borders and rules; night phases to 13%/24% white.

### Named Rules

**The Flat Calm Rule.** (User-pinned, dial "B") No gradient fills on any control. Primary actions are solid cobalt (`--action`). The cobalt→rose sweep (`--wash`, 105deg cobalt → rose → rose-light) survives only as identity material in the Horizon foundation piece and future brand moments — never on buttons, fields, cards, or badges.

**The One Lit Control Rule.** Only the primary action carries solid color. Everything else is hairline, tonal, or text. If two controls on a screen are solid-filled, one of them is wrong.

**The Two Lights Rule.** Cobalt means go/act; rose means the AI is present. Never trade them: a rose button that merely submits, or a cobalt badge on AI output, breaks the contract the user reads state by.

## Typography

**Display / Cue Font:** Oswald (self-hosted via @fontsource, weights 500–600)
**Body Font:** Public Sans (self-hosted, weights 400–700)
**Mono Font:** system mono stack (ui-monospace, SF Mono, Cascadia Mono, Menlo) — code readouts only.

**Character:** Public Sans is the calm working voice; Oswald tracked caps are the stage manager's cue register — terse instrument labels that mark, never speak. The pairing reads technical but warm: an operations console that has learned manners.

### Hierarchy

- **Display / Cue** (Oswald 500, 26px, uppercase, +0.14em tracking): wordmark, hero statements, foundation piece. Always uppercase.
- **Headline** (Public Sans 650, 20px, 1.2): page titles (`--text-2xl` at 26px for section heads).
- **Title** (Public Sans 650, 16.5px, 1.2): card and dialog titles.
- **Body** (Public Sans 400, 14px, 1.55): default reading text; measure capped at 68ch (`--measure`).
- **Label / Cue small** (Oswald 500, 11.5px, uppercase, +0.14em, muted ink): field-adjacent section markers (`.tw-cue`), rail group labels, divider labels. Field labels themselves are Public Sans 600 at 11.5px with +0.08em tracking.
- **Data** (Public Sans, `font-variant-numeric: tabular-nums` via `.tw-tnum`): times, counts, hex values, any number that updates.

### Named Rules

**The Cue Register Rule.** Oswald is caps-and-tracked or nothing. It labels and marks; it never sets sentences, body copy, or button text. If a cue label needs lowercase, it isn't a cue — demote it to Public Sans.

**The Tabular Rule.** Any numeral that can change value (times, counts, live data) sets `tabular-nums`. Proportional figures are for prose only.

## Layout

Slightly condensed density with protected negative space (brand commitment). The spacing scale is a compact 8-step ramp (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px); most component internals live at 8–16px, section separation at 32–48px, and major rests at 64px.

- **Reading measure:** body text caps at 68ch (`--measure`).
- **Component bands:** stories and content sit in max-width ~860px columns with 32px internal padding — generous air around small controls.
- **Showcase shell:** a 252px night rail (the cue sheet) beside a day canvas; below 900px the rail folds into a horizontal strip above the canvas. Product apps should reuse this operator/canvas split when a persistent navigation rail exists.
- **Dialog measure:** overlays center at `min(440px, 100vw − 32px)`.

**The Air Is Load-Bearing Rule.** Do not compress spacing to fit more on screen. The calm comes from the rests between bands; if a layout feels crowded, remove content before removing space.

## Elevation & Depth

This system is flat. Depth is conveyed by hairline borders and tonal banding alone — `--line` at rest, `--line-strong` on hover, `--bg-band` / `--bg-band-strong` for recessed or hovered areas. There are no card shadows, no drop shadows, no glow, no colored shadows (user-pinned).

The single exception is the dialog overlay, which carries one small, soft shadow so the lit panel reads above the dimmed stage. Its entrance (fade + 10px rise + 4px blur clearing over 320ms) is the authored cue-up moment.

### Shadow Vocabulary

- **Overlay** (`0 12px 28px -10px rgb(5 5 6 / 0.18)` day / `0 14px 32px -10px rgb(0 0 0 / 0.6)` night): dialog panels only. Nowhere else.

### Named Rules

**The One Shadow Rule.** The dialog overlay owns the only real shadow in the system. Everywhere else, elevation is a hairline plus a tonal band. A new shadow anywhere is a finding, not a feature.

**The Focus Is Light Rule.** Focus and validation states arrive as rings of light (`box-shadow: 0 0 0 3px var(--ring)`, cobalt at 22%/35% opacity) plus a border shift — never as elevation.

## Shapes

Form language is softly squared: small, even radii that read as machined instruments rather than bubbles.

- **Controls and inputs:** 10px radius (`--r-md`); small buttons and checkboxes tighten to 6px (`--r-sm`).
- **Cards, dialogs, story panels:** 14px radius (`--r-lg`).
- **Pills** (999px): badges, avatars, radios, switches — reserved for elements that are intrinsically round or read as status tokens.
- **Borders:** 1px hairlines everywhere; structure is drawn with lines, not fills. The divider is the "horizon rule": a 1px hairline that fades to transparent at both edges.

**The Hairline Rule.** 1px or nothing. If a boundary needs more than a hairline plus a tonal shift, the grouping is wrong — re-band, don't thicken.

## Components

All primitives ship as React wrappers (`tw-*` classes) over the shared CSS in `packages/ui/src/styles/`, written against phase-aware semantic tokens. Every interactive component transitions on the shared ease (`cubic-bezier(0.16, 1, 0.3, 1)`, 120–200ms) and honors reduced motion.

### Buttons

- **Shape:** gently squared (10px radius; 6px at small size). Heights 28 / 34 / 42px (sm / md / lg), padding 0 10/14/20px.
- **Primary:** solid cobalt fill (`--action`), white text, faint inset top-light (`inset 0 0 0 1px rgb(255 255 255 / 0.16)`); hover deepens to cobalt-deep; active darkens via `brightness(0.94)`. The one lit control.
- **Secondary:** white surface, strong hairline border; hover shifts border and text to cobalt — the outline lights up rather than filling.
- **Ghost:** borderless cobalt text; hover lays a cobalt 8% tonal band behind.
- **Danger:** borderless deepened-rose text with a 40% rose hairline; hover lays the danger tonal band.
- **Disabled:** 45% opacity, no hover response; primary keeps its fill so the lit control never half-lights.

### Fields (input, textarea, select, checkbox, radio, switch)

- **Style:** hairline instruments — white surface, 1px strong hairline, 10px radius, 34px height. Placeholders in muted ink.
- **Focus:** border shifts to cobalt plus a 3px cobalt ring at 22% opacity — focus is a ring of light, not elevation.
- **Invalid:** deepened-rose border; the ring tints rose (20% danger ink).
- **Checkbox/radio:** a small box that lights up — checked fills solid cobalt (check glyph) or a 5.5px cobalt ring (radio).
- **Switch:** the track itself lights flat cobalt when on; knob slides 17px on the shared ease over 200ms.
- **Labels/hints/errors:** field labels are tracked caps (11.5px, +0.08em, semibold); hints in muted ink; errors in danger ink.

### Badges

- **Style:** small lit pill (999px radius, 2.5px 10px padding), tracked caps 11.5px with tabular numerals.
- **Variants:** neutral (tonal band), go (cobalt on 8% cobalt), rose (rose on 10% rose — AI presence), warning (dawn-tinted), danger (deepened rose).

### Cards / Containers

- **Corner Style:** 14px radius.
- **Background:** white surface over the day ground (or `--surface` on night).
- **Shadow Strategy:** none — hairline only (see The One Shadow Rule).
- **Border:** 1px quiet hairline at rest, strong hairline on hover.
- **Internal Padding:** 24px.

### Tabs

- Quiet text row over a bottom hairline; active tab gets full ink and a 2px cobalt underline — the active tab's horizon lights in cobalt. Hover raises muted ink to full ink.

### Navigation (showcase rail)

- Night cue-sheet rail: Oswald tracked-caps group labels, numbered cues, Public Sans items. Active item is the "lit band": cobalt 8–14% tonal fill plus an inset cobalt 45% hairline — never a solid fill.

### Overlays (dialog, tooltip)

- **Dialog:** one lit panel rising over a 45% night backdrop; 14px radius, the system's only real shadow, and the authored cue-up entrance (320ms).
- **Tooltip:** a console readout — always depthless night with light text, 6px radius, appears on hover/focus with a 2px rise. Brief by contract.

### Loading (skeleton)

- A tonal band warming up: 90deg shimmer across `--bg-band`/`--bg-band-strong` at 1.4s, flat colors only — never the identity gradient. Disabled entirely under reduced motion.

### Signature: The Horizon

The foundation piece (showcase "The Horizon"): the full palette as six stacked bands — night, cobalt horizon, rose gather, rose light, dawn wash, day — each carrying its Oswald cue number, name, and tabular hex. This is the only surface where the cobalt→rose sweep (`--wash`) may appear at product scale.

## Do's and Don'ts

### Do

- **Do** write components against semantic tokens (`--bg`, `--ink`, `--line`, `--accent`, `--action`) so both phases resolve for free; flip phases with `[data-phase="night"]`, never with hard-coded colors.
- **Do** keep exactly one solid cobalt control per view — the primary action (The One Lit Control Rule).
- **Do** use rose only where the AI is present (The Two Lights Rule).
- **Do** elevate with hairlines and tonal bands: `--line` → `--line-strong`, `--bg-band` → `--bg-band-strong`.
- **Do** set data, times, and counts in tabular numerals (`.tw-tnum`).
- **Do** keep grain at 0.06 (day, multiply) / 0.08 (night, screen) over large fields — matte tooth, never glossy (user-pinned).
- **Do** honor `prefers-reduced-motion`: all transitions and the cue-up entrance collapse.

### Don't

- **Don't** put gradient fills on any control — primary actions are solid cobalt; `--wash` is identity material for the Horizon piece and brand moments only (The Flat Calm Rule, user-pinned).
- **Don't** add glow, colored shadows, or drop shadows; the dialog overlay owns the only real shadow (The One Shadow Rule, user-pinned).
- **Don't** set Oswald in sentence case or for body/button text (The Cue Register Rule).
- **Don't** use rose for ordinary actions or cobalt for AI output.
- **Don't** compress spacing to fit more; remove content before removing air (The Air Is Load-Bearing Rule).
- **Don't** introduce new easing curves or bouncy motion — one exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`); light rises, never bounces.
- **Don't** add Tailwind or CSS-in-JS to `packages/ui`; the token contract is plain CSS custom properties consumed as source.
