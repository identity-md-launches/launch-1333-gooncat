# GOONCAT website design system

Documents the design as implemented in `site/` (source) and exported byte-for-byte to `dist/`.
Values below are taken from `site/assets/css/style.css` and the markup in `site/index.html`,
confirmed in a headless Chromium pass at 320, 390 and 1440 CSS pixels (see
`artifacts/validation.md`). Design guidance followed Better Interface's six domains.

## Overview

Audience: people who land on gooncat.si-md.xyz from X or the si-md.xyz launchpad and want to
know what $GOONCAT is, check live numbers and buy or share. The character is a loud,
sticker-covered meme site on a dark espresso ground, with the three colours of the logo
(ivory blanket, pink floral sprigs, and the frogs' lime as the contrast colour) cranked up to
full saturation. Everything is thick-outlined, hard-shadowed and slightly tilted; textures are
CSS-only (grain overlay on `body::before`, halftone dots on `.halftone`).

System-wide rules: dark theme only, three brand hues with fixed jobs, one display face for
every heading and button, a 4px spacing scale, 3px ink outlines with offset solid shadows,
and motion that is opt-in under `prefers-reduced-motion: no-preference`.

Page-specific arrangements (not rules): the hero's two-column grid, the city scene, the donut.

## Colors

Defined on `:root` in `site/assets/css/style.css`. Primitives are named by hue; components
only use the semantic tokens.

| Semantic token | Primitive | Value | Job |
| --- | --- | --- | --- |
| `--color-bg` | `--espresso-950` | `#120d0b` | page background |
| `--color-bg-alt` | `--espresso-900` | `#1a1310` | alternating section background (`.section-alt`) |
| `--color-surface` | `--espresso-800` | `#261c18` | cards, copy rows, inputs' container |
| `--color-surface-raised` | `--espresso-700` | `#3b2d26` | ghost/neutral buttons, hover fills |
| `--color-border` | `--espresso-600` | `#5a463c` | reserved for structural borders |
| `--color-text` | `--oat-100` | `#fff6e5` | primary text |
| `--color-text-muted` | `--oat-300` | `#d9c9b8` | secondary text, captions |
| `--color-ink` | `--espresso-950` | `#120d0b` | outlines, sticker shadows, text on bright fills |
| `--color-accent` / `-strong` | `--butter-400` / `-500` | `#ffe066` / `#ffd21f` | primary action fill, hero word, donut pool segment |
| `--color-loud` / `-soft` | `--sprig-400` / `-300` | `#ff4d9d` / `#ff7fb9` | secondary loud fill, ticker, donut swarm segment |
| `--color-contrast` / `-strong` | `--frog-400` / `-500` | `#b4ff3c` / `#8ee600` | links, tertiary fill (copy buttons), success/"live" cues, frogs |
| `--color-focus` | `--frog-400` | `#b4ff3c` | `:focus-visible` ring (3px, offset 3px) |

Rules: exactly one accent-filled primary action per view (`.btn-primary`); pink and lime fills
mark secondary and utility actions, not peers of the primary. Lime is also the link colour, so
do not use it on static text. Measured WCAG 2 ratios for the declared pairs are listed by
`node web/check.mjs` (all pass AA; e.g. body text on page 17.98:1, ink on pink 6.25:1).

## Typography

Google Fonts, loaded with `display=swap` from `index.html`; fallbacks are declared in the tokens.

- `--font-display`: Bungee 400 (fallback Impact, Arial Black). Headings, buttons, badges,
  stat values, the marquee. Bungee is a single-weight face; never request other weights.
- `--font-text`: Nunito 400/700/800 (fallback Segoe UI, system-ui). Body, labels, nav links.
- `--font-mono`: Space Mono 400. Contract addresses and `<code>`.

Type scale (six sizes, all on `:root`):

| Token | Value | Used for |
| --- | --- | --- |
| `--fs-xs` | 13px | badges, captions, stat labels, meter labels |
| `--fs-sm` | 15px | UI text, nav links, small buttons, notes |
| `--fs-md` | 17px | body, default buttons |
| `--fs-lg` | 24px | section lead paragraphs, `h3`, hero line, fact values |
| `--fs-xl` | clamp(32px → 56px) | `h2`, stat values, donut centre |
| `--fs-2xl` | clamp(48px → 120px) | `h1` only |

Headings use `line-height: 1.05`, `text-wrap: balance`, `letter-spacing: -0.01em`; body is
1.55 with `text-wrap: pretty` and a 62ch measure (`--measure`). Changing numbers carry `.num`
(`font-variant-numeric: tabular-nums`). Inputs are 16px so iOS does not zoom. Font smoothing
is set once on `html`.

## Layout

- Container: `.wrap` = `min(100% - 2rem, 72rem)`, 4rem side margins from 48rem up.
- Spacing scale: `--sp-1` 4px … `--sp-9` 96px (4, 8, 12, 16, 24, 32, 48, 64, 96).
- Sections: `.section` pads 64px vertically, 96px from 60rem; `.section-head` sits 32px above
  its content; `scroll-margin-top` equals the sticky nav height (`--nav-h`, 4rem).
- Breakpoints come from content: 40rem (stats go to 3 columns), 48rem (story beats, how-to-buy
  split, vibe row, footer), 56rem (tokenomics and generator two columns), 60rem (hero two
  columns, desktop nav replaces the menu button).
- Grids: `.beats` 3 columns, `.meme-grid` auto-fill 15rem, `.facts` auto-fit 10rem,
  `.districts` auto-fit 11rem, `.templates` auto-fill 5rem.
- Overflow: `body { overflow-x: clip }`; the marquee lives inside `.marquee-wrap` with
  `overflow: hidden` because it is rotated and slightly scaled. The city scene clips itself.
  Verified no horizontal scroll at 320, 390 and 1440.
- Logical properties (`inset-inline`, `padding-inline-start`) are used where direction matters.

## Elevation & depth

Flat surfaces with hard offset shadows, not blur: `--shadow-sticker: 6px 6px 0 var(--color-ink)`
on cards, buttons and badges; hover lifts the button 2px and grows the shadow to 8px, press
drops it to 2px with `scale: 0.96`. `--shadow-float` (soft) is reserved and unused on the home
page. The sticky nav is translucent (`color-mix` 88% of `--color-bg`) with `backdrop-filter`.
Images get a 1px white 10% outline over the ink border (`.brand img`, `.hero-logo`).

## Shapes

`--r-sm` 8px (inputs, nav links, small tiles), `--r-md` 16px (buttons, copy rows, art frames),
`--r-lg` 24px (cards, the city frame), `--r-pill` for badges and the meter. Outer radius equals
inner radius plus padding (card 24px around a 16px art frame with 8px gap). Every component has
a `--outline` (3px) solid ink border. Stickers tilt with `--tilt` (−10deg to 8deg).

## Components

All in `site/assets/css/style.css`; behaviour in `site/assets/js/app.js`.

- **Button `.btn`** with variants `.btn-primary` (accent, one per view), `.btn-loud` (pink),
  `.btn-contrast` (lime, copy/download utilities), `.btn-ghost` (neutral), `.btn-sm`. Works on
  `<a>` and `<button>`. States: hover lift, active press, `:focus-visible` ring,
  `aria-disabled="true"` at 60% opacity (used for "Copy address" before the token exists; the
  button stays focusable and explains itself via toast). `.magnetic` adds a pointer-follow nudge
  on fine pointers only.
- **Badge `.badge`** (+ `.badge-loud`, `.badge-accent`, `.badge-muted`, `.sticker` tilt).
- **Card `.card`** surface for every grouped block; `.beat` adds a numbered counter.
- **Copy row `.copy-row`**: label + `<code>` + button; the contract one is filled from live data.
- **Nav `.nav`**: sticky, desktop links from 60rem, `data-menu-toggle` button with
  `aria-expanded` toggling `.nav-menu`; Escape closes and returns focus.
- **Stats `.stat`**: label + `.v.num` value; values animate between fetches, text falls back to
  "launching…".
- **Tabs (how to buy)**: `role="tablist"` with roving tabindex, arrow/Home/End keys, Next/Back
  buttons inside panels.
- **Donut `.donut`**: two SVG circles with `stroke-dasharray` set from `data-seg` on scroll.
- **Meme card `.meme`** and **generator** (`.templates`, `.field`, `.gen-preview`): SVG strings
  from `TEMPLATES` in `app.js`; download rasterises the SVG to a 1200px PNG through canvas.
- **City `.city`**: `role="application"` region, focusable, arrow/WASD keys, drag, Back/Walk
  buttons; `--walk-z` drives the 3D world; `.billboard` shows live market data.
- **Meter `.meter`**: `role="meter"` with `aria-valuenow`, driven by `--vibe`.
- **Toast `.toast`** (`role="status"`), **confetti layer** (DOM particles with CSS keyframes).

Loading state: every live field starts as "launching…" and the stats footer says "Live data
not available yet" until `/simd-coin.json` answers. Empty states for votes read "0 votes".

## Motion

All continuous motion is inside `@media (prefers-reduced-motion: no-preference)`: logo bounce
(2.2s), marquee (28s), hover wobble (500ms), rain, paw wave, frog hops, billboard flicker,
donut sweep (1200ms), scroll reveals (600ms, `--delay` stagger of 100ms) and the ambient city
walk. Under `reduce`, elements render in their final state, the marquee wraps statically and
smooth scrolling is off. Easing token: `--ease-out: cubic-bezier(0.2, 0, 0, 1)`; interactive
transitions are 150ms and name their properties.

## Do's and don'ts

- Start a new page from `site/404.html`: same head, `.nav`, `.wrap`, `.footer`; keep the
  footer sentence verbatim.
- Use tokens only; never hard-code a hex in a component. Add a semantic token if a role is missing.
- One `.btn-primary` per view. Copy/download utilities are `.btn-contrast`; share actions are
  `.btn-loud`; everything else `.btn-ghost`.
- Keep headings in Bungee and descending through the scale; never introduce a seventh size.
- Keep live values in `.num` elements and always provide the "launching…" fallback.
- Do not add wallet connections, forms that collect data, trackers or return promises.
- New extra pages go in their own folder under `site/` (for example `site/city/index.html`)
  with root-relative asset links like `404.html` uses; home keeps relative links.
