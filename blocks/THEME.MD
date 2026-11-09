# THEME.md — Isometric Lab

> A complete, self-contained specification of the **Isometric Lab** visual theme. An agent with no other context should be able to reproduce any screen, diagram or component in this style from this file alone. All values are exact; where a value is a judgement call it says so.

---

## 1. What this theme is

Isometric Lab is a visual language for **science and engineering explainers**: an isometric, cut-away technical drawing sitting on drafting grid paper, softened with four pastel colour zones, titled with a heavy grotesk headline and keyed by a simple two-column legend.

The reference it was derived from: a short-form explainer frame showing an isometric fusion test rig ("Fusion reactor", "San Francisco") with four colour-coded parts — *Ion beam* (blue), *Tritium target* (green), *Transmutation target* (pink), *Materials testing* (orange).

**One-line tagline:** *Hard machines, drawn simply on grid paper.*

**Personality:** calm, precise, curious, friendly. A technical manual that wants you to understand, not one that wants to impress you. Excitement belongs to the subject, never to the styling.

### Core principles

1. **Paper first.** Every frame starts on warm off-white drafting paper with a faint square grid.
2. **One line weight.** Every drawn edge, swatch border and card border uses the same 1.5px outline. No exceptions.
3. **Colour means *which part*, never good or bad.** The four pastel zones identify parts of a system. They are not status colours.
4. **Flat, never glossy.** No drop shadows, no bevels, no gradients — with exactly one exception: the soft `glow` halo at the point of reaction.
5. **One idea per frame.** Max four colour zones. More than four means two diagrams.
6. **Fills are not text.** Zone colours are only ever fills. Text is always `ink` or `ink-muted`.

---

## 2. Colour

Two themes. **Light is primary** and matches the reference. Dark is a faithful night version: warm charcoal paper, cream ink, and zone fills deepened so they stay visible.

### 2.1 Token table

| Token | Light | Dark | Role |
|---|---|---|---|
| `paper` | `#f2efe8` | `#1b1a18` | Page / canvas background. The drafting sheet. |
| `paper-grid` | `#e3dfd5` | `#2a2825` | Faint square grid lines over `paper`. Decorative only — never a border, never near text. |
| `stone` | `#ebe5d8` | `#2e2b27` | Neutral solid surfaces: walls, plinths, base slabs, cards, selected chips, secondary buttons. |
| `stone-hatch` | `#c9bfae` | `#4a453e` | Diagonal hatching on `stone` to mark a cut or back face. Also unselected chip borders. |
| `ink` | `#1f1d1a` | `#f1ede4` | Headings and primary text. Primary button fill. |
| `ink-muted` | `#5f5b54` | `#a9a397` | Subtitles, location lines, legend labels, card body text. |
| `outline` | `#3a3732` | `#cfc8bb` | The single outline colour for every drawn edge and border. |
| `ion` | `#a9c1e8` | `#5d76a6` | **Zone 1** fill (blue). |
| `ion-deep` | `#4f63ad` | `#9fb4e6` | Particles, beam cores, accents inside zone 1. Also links and the **focus ring**. |
| `tritium` | `#a8d8b9` | `#4c8763` | **Zone 2** fill (green). |
| `transmute` | `#eab0bd` | `#a9677a` | **Zone 3** fill (pink). |
| `materials` | `#f2bf8f` | `#b47c48` | **Zone 4** fill (orange). |
| `glow` | `#f6d77a` | `#e8c45a` | The reaction point — a soft radial halo. Exactly one per diagram. |
| `pin` | `#c8323f` | `#ef6f7a` | Location pin and single-point markers. **Not** an error colour. |

> Values are an informed reading of a single reference image, tuned for contrast — not brand-measured. Treat them as canonical for this theme.

### 2.2 Paste-ready CSS

```css
:root, [data-theme="light"] {
  --paper: #f2efe8;      --paper-grid: #e3dfd5;
  --stone: #ebe5d8;      --stone-hatch: #c9bfae;
  --ink: #1f1d1a;        --ink-muted: #5f5b54;   --outline: #3a3732;
  --ion: #a9c1e8;        --ion-deep: #4f63ad;
  --tritium: #a8d8b9;    --transmute: #eab0bd;   --materials: #f2bf8f;
  --glow: #f6d77a;       --pin: #c8323f;
}
[data-theme="dark"] {
  --paper: #1b1a18;      --paper-grid: #2a2825;
  --stone: #2e2b27;      --stone-hatch: #4a453e;
  --ink: #f1ede4;        --ink-muted: #a9a397;   --outline: #cfc8bb;
  --ion: #5d76a6;        --ion-deep: #9fb4e6;
  --tritium: #4c8763;    --transmute: #a9677a;   --materials: #b47c48;
  --glow: #e8c45a;       --pin: #ef6f7a;
}
/* Follow the OS when no explicit theme is set */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #1b1a18; --paper-grid: #2a2825; --stone: #2e2b27; --stone-hatch: #4a453e;
    --ink: #f1ede4; --ink-muted: #a9a397; --outline: #cfc8bb;
    --ion: #5d76a6; --ion-deep: #9fb4e6; --tritium: #4c8763; --transmute: #a9677a;
    --materials: #b47c48; --glow: #e8c45a; --pin: #ef6f7a;
  }
}
```

### 2.3 Colour rules

- **Zone order is fixed:** 1 `ion` → 2 `tritium` → 3 `transmute` → 4 `materials`. Use fewer zones by dropping from the end.
- Zones are told apart by **hue and lightness** (blue/green read lighter than pink/orange in grayscale), but always pair them with a Legend — never rely on colour alone.
- **Never put text on a zone fill.** Mid-tone dark-theme fills fail contrast with both ink and paper. If a component needs a zone identity *and* text (e.g. Chip), put the zone in a small dot and keep the text on `paper`/`stone`.
- `glow` appears once per diagram. `pin` appears once per frame.
- No other colours. No blue-purple gradients, no neon, no pure black `#000` or pure white `#fff`.

### 2.4 Contrast (verified)

| Pair | Light | Dark |
|---|---|---|
| `ink` on `paper` | ≈15:1 | ≈15:1 |
| `ink-muted` on `paper` | ≈6:1 | ≈7:1 |
| `ink-muted` on `stone` | ≈5.3:1 | ≈5.5:1 |
| `paper` on `ink` (primary button) | ≈15:1 | ≈15:1 |
| `ion-deep` focus ring on `paper` | ≈5:1 | ≈8:1 |

---

## 3. Typography

### 3.1 Families

| Key | Stack | Source |
|---|---|---|
| `sans` | `"Inter", "Helvetica Neue", Arial, system-ui, sans-serif` | Google Fonts, weights 400 / 500 / 700 / 800 |
| `mono` | `"JetBrains Mono", ui-monospace, Menlo, monospace` | Google Fonts, weight 500 |

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
```

### 3.2 Type scale

| Style | Family | Size / line | Weight | Tracking | Colour | Use |
|---|---|---|---|---|---|---|
| `display` | sans | 64 / 68px | 800 | −0.02em | `ink` | Hero title of a frame ("Fusion reactor") |
| `title` | sans | 36 / 40px | 700 | −0.015em | `ink` | Section or secondary diagram title |
| `subtitle` | sans | 22 / 28px | 400 | 0 | `ink-muted` | Location / context line under a title |
| `legend` | sans | 17 / 24px | 400 | 0 | `ink-muted` | Legend labels; card titles at 700 in `ink` |
| `body` | sans | 15 / 22px | 400 | 0 | `ink-muted` | Card body, descriptions |
| `callout` | mono | 12 / 16px | 500 | +0.04em, UPPERCASE | `ink` | Leader-line labels on a drawing only |

Buttons: sans 15/20 at 700. Chips: sans 15/20 at 500. Tag: sans 22/28 at 800, −0.01em.

### 3.3 Writing rules

- **Titles:** a plain noun phrase in sentence case. "Fusion reactor", not "How Fusion Reactors Work!".
- **Context line:** exactly one muted line under the title — a place, a date, or a scale ("Cross-section, 1:20").
- **Labels:** two or three-word nouns. No verbs, no end punctuation. "Tritium target", not "The target is made of tritium."
- **Callouts:** two words max, uppercase via CSS (write them in sentence case in source).
- **Tags:** one word, lowercase is fine ("fusion").
- No exclamation marks, no emoji anywhere in the UI.

---

## 4. Spacing, radius, stroke

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tiny nudges; swatch inset |
| `space-2` | 8px | Swatch → label gap; button vertical padding |
| `space-4` | 16px | Card padding; legend row gap |
| `space-6` | 24px | **Paper grid pitch**; phone side gutter; legend column gap |
| `space-10` | 40px | Between title block, drawing and legend; callout leader length |

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Swatches, drawn blocks, callout labels |
| `radius-md` | 10px | Cards, tags, sheets |
| `radius-pill` | 999px | Buttons, chips |

| Token | Value | Use |
|---|---|---|
| `stroke-hair` | 1px | Paper grid, hatching |
| `stroke-line` | 1.5px | **Every** outline: drawn objects, swatches, cards, buttons, chips |

```css
:root {
  --space-1: 4px; --space-2: 8px; --space-4: 16px; --space-6: 24px; --space-10: 40px;
  --radius-sm: 4px; --radius-md: 10px; --radius-pill: 999px;
  --stroke-hair: 1px; --stroke-line: 1.5px;
  --font-sans: "Inter", "Helvetica Neue", Arial, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}
```

**No shadow tokens exist.** Elevation is never shown with shadows.

---

## 5. The drawing (the heart of the theme)

The illustration is the iconography. Any explainer diagram must follow these rules.

### 5.1 Projection
- **True isometric:** horizontal edges at **30°** above the horizontal in both directions; verticals stay vertical. No perspective, no vanishing points.
- Objects are simple primitives: boxes, cylinders, spheres, rods, frames, coils. Detail comes from *composition*, not texture.

### 5.2 Line
- Every visible edge: `outline` colour, `stroke-line` (1.5px), round joins. Same weight for a wall and a bolt.
- Hidden edges are not drawn.

### 5.3 Surfaces
- **Structure** (walls, back panels, base slab, plinths): `stone`.
- **Cut / back faces:** `stone` with diagonal `stone-hatch` lines at 45°, `stroke-hair`, ~6–7px pitch.
- **A speckle/grain** on stone is optional and must be very subtle (≤10% opacity `stone-hatch` dots).

### 5.4 Zones
- Each functional part gets one zone colour applied two ways:
  1. A **flat floor plate** (a parallelogram in isometric) under the part, in the zone colour.
  2. The part itself **tinted** in the zone colour (lighter/darker faces may be ±6% lightness of the zone colour to show form — this is shading, not a gradient).
- `ion-deep` small circles (4–6px, outlined) mark particles or sensor points scattered around a zone-1 assembly.

### 5.5 Glow
- One soft radial halo in `glow` at the point of action (e.g. where a beam hits a target). Feathered edge, 30–60% opacity at centre fading to 0. This is the **only** gradient permitted in the theme.

### 5.6 Composition (reference layout)
A long base slab running bottom-left → top-right with a tall back wall behind it. Parts are arranged left-to-right along the slab in zone order: the zone-1 source on the left (a sphere on coil springs feeding a cylindrical accelerator), a beam rod crossing a dividing wall, the zone-2 target in a frame cage in the middle with the glow, the zone-3/4 apparatus in a box on the right. Read order = data flow = legend order.

---

## 6. Frame composition

The canonical explainer frame (portrait, mobile-first):

```
┌─────────────────────────────┐
│        [Sheet: paper+grid]  │
│                             │
│        Fusion reactor       │  ← TitleBlock (display, centred)
│        📍 San Francisco     │  ← pin + subtitle
│                             │  ← space-10
│     ╱ isometric drawing ╲   │  ← the diagram, ~55–60% of height
│    ╱  with Callouts      ╲  │
│                             │  ← space-10
│  ■ Ion beam   ■ Tritium tgt │  ← Legend, 2 columns
│  ■ Transmut.  ■ Materials   │
│                             │
│          [ fusion ]         │  ← optional Tag
└─────────────────────────────┘
```

- Vertical stack, centred. Title block → `space-10` → drawing → `space-10` → legend.
- Side gutter: `space-6` (24px) on phones.
- Diagrams sit directly on the sheet: no card around them, no shadow.
- Desktop: same stack, max content width ~720px, centred.

---

## 7. Components

React components (namespace `IsometricLab`), all class-prefixed `il-`. Below are the full specs; the CSS is the source of truth.

### 7.1 Sheet — the drafting-paper ground
Props: `grid?: boolean = true`, `style`, `children`.
```css
.il-sheet { background-color: var(--paper); padding: var(--space-6); border-radius: var(--radius-md);
  background-image:
    linear-gradient(var(--paper-grid) var(--stroke-hair), transparent var(--stroke-hair)),
    linear-gradient(90deg, var(--paper-grid) var(--stroke-hair), transparent var(--stroke-hair));
  background-size: var(--space-6) var(--space-6); }
.il-sheet-plain { background-image: none; }
```

### 7.2 TitleBlock — title + context line
Props: `title`, `location?` (shows red pin), `subtitle?` (plain line, used only if no location), `size?: 'title' | 'display'`, `align?: 'center' | 'left'` (default centre).
- Pin glyph: 16×22 teardrop SVG, `fill: var(--pin)`, inner hole r=3 in `paper`. Path: `M8 0a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8z`.
```css
.il-tb-title { margin:0; color:var(--ink); font:700 36px/40px var(--font-sans); letter-spacing:-0.015em; }
.il-tb-title.il-tb-display { font-size:64px; line-height:68px; font-weight:800; letter-spacing:-0.02em; }
.il-tb-loc { margin:var(--space-2) 0 0; display:inline-flex; align-items:center; gap:var(--space-2);
  font-size:22px; line-height:28px; color:var(--ink-muted); }
```

### 7.3 Swatch — a zone key
Props: `zone` (`ion|tritium|transmute|materials|glow|stone`), `size = 28`.
```css
.il-swatch { display:inline-block; flex:none; border-radius:var(--radius-sm);
  border:var(--stroke-line) solid var(--outline); box-sizing:border-box; }
/* fill via .il-fill-<zone> { background: var(--<zone>) } */
```

### 7.4 Legend — names the zones
Props: `items: {zone, label}[]`, `columns = 2`.
- CSS grid, `column-gap: space-6`, `row-gap: space-4`.
- Each item: Swatch (28px) + label, gap 12px, `legend` style in `ink-muted`.
- Order = drawing reading order (left→right), filled row by row.
- 2–4 items.

### 7.5 Callout — leader-line annotation
Props: `label`, `zone = 'ion'`, `direction?: 'right' | 'left'`.
- Anatomy: 8px dot (zone colour; `ion-deep` for zone 1) with outline → 40px horizontal hairline at `stroke-line` → label box.
- Label: mono `callout` style, uppercase, `ink` on `paper`, 1.5px outline, `radius-sm`, padding 2px 8px.
- Position absolutely so the dot sits on the part. `left` flips the order for parts on the right half.

### 7.6 Card — flat note panel
Props: `title?`, `hatched?`, `children`.
```css
.il-card { background:var(--stone); border:var(--stroke-line) solid var(--outline); border-radius:var(--radius-md); overflow:hidden; }
.il-card-hatch { height:var(--space-6); border-bottom:var(--stroke-line) solid var(--outline);
  background:repeating-linear-gradient(135deg, var(--stone-hatch) 0 1px, transparent 1px 7px); }
.il-card-body { padding:var(--space-4); font:400 15px/22px var(--font-sans); color:var(--ink-muted); }
.il-card-title { margin:0 0 var(--space-1); font:700 17px/24px var(--font-sans); color:var(--ink); }
```
No shadow, ever. `hatched` echoes a cut face.

### 7.7 Button
Props: `variant: 'primary' | 'secondary' | 'ghost'`, `size: 'sm' | 'md' | 'lg'`, native button props.
| Variant | Fill | Text | Border | Hover |
|---|---|---|---|---|
| primary | `ink` | `paper` | `ink` | — |
| secondary | `stone` | `ink` | `outline` | fill → `paper-grid` |
| ghost | transparent | `ink` | transparent | fill → `stone` |

- Shape: pill (`radius-pill`), 1.5px border, sans 15/20 700.
- Padding: md `8px 20px`; sm `4px 16px` at 13px; lg `12px 24px` at 17px.
- Active: `translateY(1px)`. Disabled: opacity .45. Focus: `outline: 2px solid var(--ion-deep); outline-offset: 2px`.
- One primary per view.

### 7.8 Chip — zone filter toggle
Props: `zone?`, `selected?`, native button props. Sets `aria-pressed`.
- Unselected: `paper` fill, `stone-hatch` border, `ink-muted` text.
- Selected: `stone` fill, `outline` border, `ink` text.
- Optional 12px circular zone dot (outlined) before the label. **The zone colour lives only in the dot.**
- Pill, sans 15/20 500, padding `4px 16px 4px 12px`, gap 8px.

### 7.9 Tag — bold topic caption
- Solid `ink` fill, `paper` text, sans 22/28 800, −0.01em, padding `4px 16px`, `radius-md`.
- One or two words. Max one per frame. Mirrors the dark caption chip over the reference frame.

---

## 8. Iconography & imagery

- **There is no icon set.** The drawings are the iconography.
- Small glyphs (pin, chip dots) are simple filled shapes in one token colour, outlined only when they sit on a zone fill.
- No emoji, no photos inside diagrams, no 3D renders, no stock illustration styles.

---

## 9. Motion (light guidance)

The reference is a short video, so subtle motion is in character:
- Beam pulses travelling along the rod in `ion-deep`; the `glow` breathing 0.9→1.0 scale over ~2s.
- Parts may slide in along isometric axes (30° paths) with ease-out, 250–400ms.
- Never bounce, spin, or parallax. Respect `prefers-reduced-motion: reduce` by disabling all of it.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| Start every frame on grid paper | Use white `#fff` cards floating on grey |
| One 1.5px outline weight everywhere | Mix hairlines and heavy strokes on objects |
| Pastel fills as floor plates under parts | Put text on zone fills |
| Flat surfaces, hatching for cut faces | Drop shadows, bevels, glossy highlights |
| One `glow`, one `pin` per frame | Gradients anywhere else |
| ≤4 zones, legend in reading order | Use zone colours as success/error states |
| Sentence-case noun titles | Exclamation marks, emoji, clickbait |
| Isometric 30° projection | Perspective, fisheye, tilted 2.5D |

---

## 11. Replication checklist

Before shipping anything in this theme, confirm:

- [ ] Background is `paper` with the `paper-grid` at 24px pitch (or `grid=false` for dense content).
- [ ] Both light and dark themes render; nothing vanishes in dark.
- [ ] Every outline is `outline` at 1.5px.
- [ ] Zone colours used only as fills, in fixed order, ≤4, with a Legend.
- [ ] All text is `ink` or `ink-muted`; contrast ≥4.5:1 in both themes.
- [ ] Title is a noun phrase with exactly one muted context line.
- [ ] No shadows; the only gradient is the single `glow` (and the hatch pattern).
- [ ] Inter + JetBrains Mono loaded; mono only on callouts.
- [ ] Focus rings are 2px `ion-deep`, offset 2px.

---

## 12. Machine-readable tokens (JSON)

```json
{
  "name": "Isometric Lab",
  "themes": ["light", "dark"],
  "color": {
    "paper":       {"light": "#f2efe8", "dark": "#1b1a18"},
    "paper-grid":  {"light": "#e3dfd5", "dark": "#2a2825"},
    "stone":       {"light": "#ebe5d8", "dark": "#2e2b27"},
    "stone-hatch": {"light": "#c9bfae", "dark": "#4a453e"},
    "ink":         {"light": "#1f1d1a", "dark": "#f1ede4"},
    "ink-muted":   {"light": "#5f5b54", "dark": "#a9a397"},
    "outline":     {"light": "#3a3732", "dark": "#cfc8bb"},
    "ion":         {"light": "#a9c1e8", "dark": "#5d76a6"},
    "ion-deep":    {"light": "#4f63ad", "dark": "#9fb4e6"},
    "tritium":     {"light": "#a8d8b9", "dark": "#4c8763"},
    "transmute":   {"light": "#eab0bd", "dark": "#a9677a"},
    "materials":   {"light": "#f2bf8f", "dark": "#b47c48"},
    "glow":        {"light": "#f6d77a", "dark": "#e8c45a"},
    "pin":         {"light": "#c8323f", "dark": "#ef6f7a"}
  },
  "font": {
    "sans": "\"Inter\", \"Helvetica Neue\", Arial, system-ui, sans-serif",
    "mono": "\"JetBrains Mono\", ui-monospace, Menlo, monospace"
  },
  "type": {
    "display":  {"family": "sans", "size": 64, "line": 68, "weight": 800, "tracking": "-0.02em"},
    "title":    {"family": "sans", "size": 36, "line": 40, "weight": 700, "tracking": "-0.015em"},
    "subtitle": {"family": "sans", "size": 22, "line": 28, "weight": 400},
    "legend":   {"family": "sans", "size": 17, "line": 24, "weight": 400},
    "body":     {"family": "sans", "size": 15, "line": 22, "weight": 400},
    "callout":  {"family": "mono", "size": 12, "line": 16, "weight": 500, "tracking": "0.04em", "transform": "uppercase"}
  },
  "space":  {"1": 4, "2": 8, "4": 16, "6": 24, "10": 40},
  "radius": {"sm": 4, "md": 10, "pill": 999},
  "stroke": {"hair": 1, "line": 1.5},
  "shadow": "none"
}
```
