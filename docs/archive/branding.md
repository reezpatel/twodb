# twodb — Brand Guidelines

_Light is the only chrome. State arrives as light, never as glow, shadow, or ornament._

## 1. Brand essence

**Name:** twodb — always lowercase, one word, no camelCase, no space.

**North Star: "Cyclorama Dawn."** The brand is a stage at first light. Surfaces are a horizon — quiet matte bands bounded by hairline rules — and every state change arrives as light rising. We refuse the category default of gray cards and drop shadows. Depth is tonal, never dimensional.

**Personality:** calm, capable, warm-technical. An operations console that has learned manners. We build for doctors, shop owners, and busy professionals — the brand must never feel like developer tooling, and never talk down to anyone.

**Three commitments (binding):**

1. **Calm UI** — slightly condensed density with protected negative space.
2. **No glow, no heavy shadows** — hairlines and tonal bands do all the work.
3. **Plain language** — the brand speaks to non-technical people first.

## 2. Color

The palette is a **single sweep of light along a horizon**: night → cobalt → rose → rose-light → dawn → day. Color is never decoration; it is the phase a surface is in.

### The two working lights

| Token | Hex | Role |
| --- | --- | --- |
| **Cobalt Horizon** | `#0A2BFF` | Structure & action. Primary buttons, focus rings, active tabs, links. Cobalt means **go/act**. |
| **Cobalt Deep** | `#0A22D6` | Hover of the solid action. |
| **Cobalt Soft** | `#6D80FF` | Quiet accents, charts, secondary series. |
| **Rose Gather** | `#D24BFF` | **The AI's light.** AI presence, suggestions, AI-generated content. Rose means **the AI is here**. Never an ordinary action. |
| **Rose Ink** | `#8A1FA8` | Rose text on day surfaces. |
| **Rose Light** | `#FF7BAE` | Rose on night surfaces. |

### The atmosphere

| Token | Hex | Role |
| --- | --- | --- |
| **Full Day** | `#FFFFFF` | Day-phase surfaces, cards. |
| **Soft Gray Ground** | `#F5F5F7` | Day-phase backdrop; white surfaces float above it. |
| **Tonal Bands** | `#FAF9FC` / `#F2F0F7` | Secondary surfaces, hover fills, skeletons. |
| **Depthless Night** | `#18181B` | Night-phase ground (editor zinc); tooltips in day. |
| **Ink** | `#121218` / `#40404E` / `#626274` | Three-step text ramp: primary, secondary, muted. |
| **Hairlines** | `#E6E4EC` / `#CFCDD9` | All borders and rules. 1px or nothing. |
| **Dawn Wash** | `#FFD7E6` | Day-phase selection highlight; warming tint, never a working color. |

### Semantics

| Meaning | Day ink | Day bg |
| --- | --- | --- |
| Warning | `#7A5200` | `#F8EED7` |
| Danger | `#9D1B4F` | `#FCE3EC` |

### Color rules (named & enforced)

- **The Two Lights Rule.** Cobalt = act, rose = AI. Never trade them — a rose button that merely submits, or a cobalt badge on AI output, breaks the contract users read state by.
- **The Flat Calm Rule.** No gradient fills on any control. The cobalt→rose sweep (`--wash`) is **identity material only** — the Horizon brand piece and marketing moments, never buttons, fields, cards, or badges.
- **The One Lit Control Rule.** Only the primary action carries solid color per view. Everything else is hairline, tonal, or text.
- **Phases, not themes.** Components are written once against semantic tokens (`--bg`, `--ink`, `--line`, `--accent`, `--action`); night is `[data-phase="night"]`, never a second palette.

## 3. Typography

| Role | Font | Usage |
| --- | --- | --- |
| **Body / UI** | Outfit (400–700, self-hosted) | The calm working voice. Geometric, round, approachable. Default 14px/1.55, +0.02em tracking. |
| **Cue / Display** | IBM Plex Sans (500–600) | The stage manager's cue register — tracked caps for labels, section markers, the wordmark. |
| **Mono** | system mono stack | Code readouts only. |

**Hierarchy:** Display/cue 26px caps tracked +0.14em → Headline 20px/650 → Title 16.5px/650 → Body 14px/400 → Label 11.5px caps tracked. Data and live numerals always `tabular-nums` (`.tw-tnum`).

- **The Cue Register Rule.** IBM Plex Sans is caps-and-tracked or nothing. It labels and marks; it never sets sentences, body copy, or button text.
- **The Tabular Rule.** Any numeral that can change value sets tabular figures.
- Reading measure caps at 68ch. Marketing surfaces may scale Outfit to `clamp(44px, 6.4vw, 84px)`; the app never sets type that large.

## 4. Shape, elevation & texture

- **Radii:** 6px (small controls) · 10px (buttons, inputs) · 14px (cards, dialogs) · pill (badges, avatars, switches). Softly squared — machined instruments, not bubbles.
- **Borders:** 1px hairlines everywhere. **The Hairline Rule:** if a boundary needs more than a hairline plus a tonal shift, the grouping is wrong — re-band, don't thicken.
- **Elevation:** hairline → strong hairline → tonal band. **The One Shadow Rule:** the dialog overlay owns the only real shadow in the system (`0 12px 28px -10px rgb(5 5 6 / 0.18)` day). A new shadow anywhere is a finding, not a feature.
- **Focus is light:** a 3px cobalt ring at 22% opacity — never elevation, never a border swap.
- **Grain:** fine fractal noise at 0.06 (day, multiply) / 0.08 (night, screen) over large fields. Matte tooth, never glossy.
- **Motion:** one exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`, 120–200ms). Light rises, never bounces. The authored entrance is the "cue-up": bands rise in sequence, 45ms stagger. `prefers-reduced-motion` collapses everything.

## 5. The Horizon (brand mark)

The signature brand asset is **The Horizon**: the full palette as six stacked bands — night, cobalt horizon, rose gather, rose light, dawn wash, day — each labeled with its IBM Plex Sans cue number, name, and tabular hex. It is the only surface where the cobalt→rose sweep may appear at product scale. Use it for hero moments, loading splashes, covers, and brand collateral — never as a background behind working UI.

## 6. Component language

All primitives ship in `@twodb/ui` and express the same grammar:

- **Buttons** — `Button` (primary = the one solid cobalt control; secondary = hairline that lights cobalt on hover; ghost = cobalt text over a tonal band; danger = deepened rose). `IconButton` for toolbar actions.
- **Fields** — `Input`, `Textarea`, `Select`, `Typeahead`, `SearchInput`, `PasswordInput`, `CodeInput`, `ColorPicker`. Muted tonal wells, no resting border; focus arrives as a ring of light. `Checkbox`, `Radio`, `Switch` light solid cobalt when on.
- **Status** — `Badge` and `TagChip` as small lit pills: neutral, go (cobalt), rose (AI), warning, danger. Rose badges only on AI output.
- **Surfaces** — `Card` (14px radius, hairline, 24px padding, zero shadow), `Divider` (the horizon rule: a hairline fading at both edges), `Skeleton` (a tonal band warming up, flat shimmer only).
- **Navigation** — `NavRail` (the app's left rail), `SideNav`, `Tabs` (active tab's horizon lights in cobalt), `Segmented`, `Menu`. Active items are lit tonal bands — borderless, never solid fills.
- **Overlays** — `Dialog` (the one shadow, the cue-up entrance), `Tooltip` (depthless night console readout, brief by contract).
- **Data** — `DataTable`, `Table`, `Calendar`, `MonthCalendar`, `DayTimeline`, `DataGantt`, `Chart`, `ScoreRing`, `FileTree`, `Chat`. Times, counts, and figures always tabular.
- **Identity** — `Avatar`, `AccountMenu`, `QrCode`, `Progress`.

If a new component needs a new shadow, gradient, or easing curve, the component is wrong — not the system.

## 7. Iconography

Lucide icons, 15–16px in rails and toolbars, stroke-weight consistent with hairlines. Icons support text; they never replace it on primary actions. Decorative icons get `aria-hidden`; interactive icons always carry a label.

## 8. Voice & tone

- **Plain language, always.** "Remind me about unpaid invoices" — not "configure recurrence rules." If a doctor can't parse a label, the label is rewritten.
- **Terse cues, warm sentences.** Instrument labels are short and caps-tracked; explanatory copy is complete, friendly sentences.
- **The AI speaks in rose but writes plainly.** AI-generated content is marked by rose presence, and it says what it did: "Drafted 6 invoice reminders" — not "task executed successfully."
- **No jargon, no exclamation marks in product UI, no fake urgency.**

## 9. Accessibility & inclusion

- Audience spans age, language, and digital literacy: legibility and forgiveness are brand requirements, not enhancements.
- Day/night phases resolve from the same tokens, so contrast is maintained by construction.
- All motion honors `prefers-reduced-motion`; skeletons disable entirely.
- Touch targets never shrink below control heights (28/34/42px ramp).
- Multi-language is a first-class brand surface — the live-scribe experience is bilingual (English/हिन्दी) by design.

## 10. Quick don'ts

- ❌ Gradient fills on controls · ❌ glow or colored shadows · ❌ new easing curves
- ❌ Rose for ordinary actions · ❌ cobalt on AI output · ❌ IBM Plex Sans in sentence case
- ❌ Compressing spacing to fit more (remove content before removing air)
- ❌ Tailwind or CSS-in-JS in the design system (plain CSS custom properties only)
- ❌ Capitalizing "twodb"
