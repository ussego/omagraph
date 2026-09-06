# Omachi design language: blueprint

Omachi's chrome and charts share one vocabulary: technical-drawing ("blueprint") frames with dashed
rules, `+` corner marks, bracketed mono captions, terminal colors, and Geist Mono. Nothing is
rounded. The active color theme supplies the terminal palette; charts and their captions use each
hue for a fixed data role. Follow this document for any UI change; extend it when the language grows.

## Tokens — `src/styles.css` is the single source of truth

- **Fonts**: `--font-sans` Geist Variable; `--font-mono` Geist Mono Variable.
  - Chrome text (wordmarks, nav, tab labels, toggles, footnotes): mono + uppercase.
  - Page headings (`h1`/`h2`): `font-heading` (sans). The mono uppercase voice belongs to chrome
    labels and charts, not to page titles.
- **Radius**: `--radius: 0`. Never add rounding.
- **Graph palette**: `--graph-accent` for primary/current data, `--graph-accent-2` for cyan secondary
  or historical data, `--graph-accent-3` for magenta category data, plus `--graph-positive`,
  `--graph-warning`, and `--graph-negative` for green/yellow/red status data. Omachi defines its own
  terminal palette; the header's color-theme picker replaces it with the chosen Omarchy palette.
- **Frame inks**: `--graph-frame` (charts and controls), `--graph-frame-soft` (page frame, roughly
  half the contrast), `--graph-muted`, `--graph-faint`.
- Components use tokens only (`bg-background`, `text-graph-accent`, …). No raw color values
  (except `src/themes/themes.ts`, the generated swatch metadata).

## Color themes

The theme control (`src/components/color-theme-picker.tsx`, header) carries the light/dark/auto
mode row and the color-theme grid: the **Omachi** default — the tokens above, no overrides — plus
the Omarchy built-in themes from their `colors.toml` files. It is a client-side layer only: the
mode writes `localStorage["theme"]` and toggles `.light`/`.dark`; picking a palette writes
`localStorage["color-theme"]` and a `data-color-theme` attribute on `<html>`; CSS custom properties
do the rest, so charts, frames, and chrome re-theme together.

- **Native mode**: a theme renders its own background/foreground/accent in its natural light/dark
  mode (`:root[data-color-theme="…"]` for light themes, `:root[data-color-theme="…"].dark` for
  dark themes). `colors.toml` maps: `background`/`foreground`/`accent` directly; surfaces
  (`--card`/`--popover`/`--sidebar`) from the theme's adjacent background keys; the shadcn fills
  (`--secondary`/`--muted`/`--accent`) all take `selection`, which sits near the background in
  every theme (omarchy's `muted` key is a dimmed *text* color, not a UI fill — it only backstops a
  missing `selection`); text on fills is the theme's own `foreground`; `--destructive` from `red`.
  The neutral ramp (`--graph-frame*`, `--contrast-*`, `--muted-foreground`, `--ring`) comes from
  interpolating the theme's background→foreground pair by the same oklch lightness fraction the
  site tokens use. The generator maps `accent`, `cyan`, `magenta`, `green`, `yellow`, and `red` onto
  the graph palette. It keeps colors that reach 4.5:1 contrast against the graph background and
  adjusts only oklch lightness when a source color misses that threshold. Missing named colors fall
  back to their `bright_*` counterpart, then to `accent`.
- **Other mode** (adaptation block): the site's own neutrals keep their contrast and only the
  graph palette moves (`:root[data-color-theme="…"]` for dark themes in light mode, `….dark` for
  light themes in dark mode). The generator applies the same contrast correction against the site's
  background. `--chart-1..5` stay neutral because Omachi's ASCII graphs use the `--graph-*` tokens.
- **Generated, not hand-written**: `bun run themes:generate` reads
  `/usr/share/omarchy/themes/<theme>/colors.toml` and rewrites `src/themes/themes.css` (the token
  blocks) and `src/themes/themes.ts` (swatch metadata) — both committed, never hand-edited
  (`src/themes/**` is excluded from Biome). Run it after system theme or styles.css token changes;
  deploys don't run it (CI never sees /usr/share/omarchy).
- **Performance**: themes.css is not in the critical path. `__root.tsx`'s pre-paint script
  injects the stylesheet only when a non-default palette is already stored (so returning users
  see no flash), and the picker injects it lazily on the first pick; visitors on the default see
  no extra bytes. Flipping palettes afterwards is one attribute change — a single style recalc,
  no re-render, no server cost.

## Terminal color grammar

- Primary/current values and general graph titles use `--graph-accent`.
- Historical or secondary values use cyan through `--graph-accent-2`. A time series may pair its
  role color on the latest point with cyan history.
- Categories and hearts use magenta through `--graph-accent-3`; views use cyan; copies use the
  primary accent.
- Verified/available values use `--graph-positive`; unknown/manual/unverified values use
  `--graph-warning`; broken or failed values use `--graph-negative`.
- A graph caption, including its brackets, matches the graph's data-role color. Mixed-status graphs
  keep an accent caption and color each row by status. Axes, frames, empty cells, and explanatory
  copy remain neutral.
- A color appears only when its role exists. Navigation, controls, tables, UI badges, page headings,
  and body copy keep their existing semantic UI tokens. Embeddable Badge SVGs use the primary accent
  as described below.

## Embeddable Badge SVGs

- Standalone badges are 20px-high, square two-field SVGs: mono uppercase label and value, with the
  value field in `--graph-accent` blue and a 1px frame using the standard 2px dash / 5px gap rhythm.
- Use Geist Mono first, then system monospace fallbacks. The `.json` representation keeps its
  per-stat color for bot compatibility; SVGs always use the primary accent.
- A fetched SVG cannot inherit the site's theme, and common README renderers do not reliably support
  CSS variables or OKLCH. `src/lib/badge-svg.ts` therefore freezes the dark background, light text,
  and light-mode `--graph-accent` as sRGB values. This is the exception to the token-only color rule;
  update those values when their source tokens change.
- Server-rendered OG PNGs have the same constraint: `src/routes/og/plugins/$id.tsx` freezes the
  dark blueprint palette as sRGB values for Takumi, and must update them when the source tokens change.

## Frame grammar (the utilities)

- **Dashed frame** `graph-frame`: repeating-linear-gradient layers on all four edges — 2px dash,
  5px gap (7px period), 1px thick. Used on chart figures, KPI tiles, tab lists, header controls,
  example cards.
- **Sides only** `graph-frame-sides`: the two vertical edges (the page frame).
- **Rules** `graph-rule` (horizontal), `graph-rule-y` (vertical), `graph-rule-soft` (page-frame
  horizontal in soft ink — navbar/footer edges and section separators).
- **Corners** `GraphCorners` (`src/components/graph-frame/graph-frame.tsx`): `+` marks straddling
  each corner with a `bg-background` punch-out; props `mark`, `ink` (default `text-graph-frame`),
  `corners` (which corners get marks; default all four), `className`. Page-frame corners use
  `ink="text-graph-frame-soft"` and are hidden below `sm`.
- **Captions** `GraphTitle`: `[ TITLE ]` straddling the top edge — mono, uppercase, and colored with
  the graph's data-role tone. Charts only.
- **Marching ants** `graph-frame-march` (styles.css): runs the frame dashes at 0.4s linear
  infinite while the wrapping `.group` is hovered; paused by default; active only under
  `prefers-reduced-motion: no-preference`.

## Scrollbars

- Scrollable regions use the owned `ScrollArea` (`src/components/ui/scroll-area.tsx`): overlay
  thumbs that reveal on hover/scroll and never shift layout.
- Thumbs stay square and use frame ink (`--graph-frame`), turning `--graph-accent` while hovering
  or scrolling. Codeblocks (`Snippet`, `src/components/snippet.tsx`) scroll horizontally through it,
  with the track docked flush and full-bleed in the block's bottom padding, clear of the text.

## Page chrome

- **Content**: `max-w-6xl` (72rem), centered. The page frame is soft vertical dashed sides
  (`graph-frame-sides`) running from the navbar's bottom rule to the footer's top rule, with `+`
  corners at the four junctions.
- **Sections**: `GraphRule` (`src/components/graph-frame/graph-rule.tsx`) — a soft dashed horizontal
  rule spanning the full page frame so it connects with the dashed sides (a `-mx-4 sm:-mx-6` bleed
  over the content padding). Use it sparingly: between major regions only — never directly under the
  page header, and never between sibling blocks of one region (adjacent charts, consecutive
  reference blocks). Loading skeletons mirror them so the swap to settled content never jumps.
- **Navbar**: full-width, `bg-background/80 backdrop-blur`, soft dashed rule at the bottom edge.
  Logo `[O]` = the Omachi mark: an accent `O` between brackets, mono, uppercase,
  `tracking-widest`, `aria-label="Omachi — home"` carries the name. Nav links = mono uppercase
  `text-xs`; active page `text-graph-accent`, inactive `text-muted-foreground`. Header controls
  (theme, search, GitHub/Sponsor, menu) all carry the dashed `graph-frame`.
- **Footer**: full-width soft dashed rule at the top; `[O]` brand mark in accent with the Omachi
  name in the muted line beneath; captions mono muted `text-xs`.
- **Tabs** (`src/components/ui/tabs.tsx`): triggers mono uppercase `text-xs`; default variant is a
  dashed `graph-frame` list on `bg-background` with a flat `bg-muted` indicator; the underline
  variant uses a `bg-graph-accent` indicator.
- **KPI tiles** (`GraphStat`, `src/components/graph-stat.tsx`): one dashed-frame figure with a
  `[ TITLE ]`, mono labels and tabular values; `hint` text sits under the label.
- **Dialogs, drawers, and popovers** (the command palette, the mobile menu, the range picker):
  square `bg-background` surfaces with no shadow or solid border. Dialogs and popovers carry the
  full dashed `graph-frame` and four `+` corner marks; drawers draw a dashed rule
  (`graph-rule`/`graph-rule-y`) on the visible edge only, with `+` marks on that edge's corners
  (`GraphCorners` `corners` prop). Group labels, titles, and keycaps are mono uppercase chrome;
  internal dividers use `graph-rule`. The mobile menu lives in `src/components/ui/drawer.tsx`.

## Interaction language

- Hover on interactive chrome fades in the marching-ants frame (200ms) — logo and nav links; the
  same frame shows on `group-focus-visible` for keyboard users.
- Logo hover additionally closes the brackets ~2px (`[ O ]` → `[O]`), 200ms ease-out.
- Motion: 200–220ms ease-out; the march is the only loop; everything respects
  `prefers-reduced-motion`.

## Loading states

- Skeletons are static muted blocks — no shimmer loop (the march is the only loop). They appear
  only after a 250ms grace period (`useSkeletonDelay`, `src/lib/loading.ts`), so fast
  edge-cached loads never flash a placeholder.
- Placeholders mirror the content they replace. Chart skeletons reuse the dashed frame and row
  geometry (`GraphRankSkeleton`, `GraphPlotSkeleton`, `GraphStatSkeleton`,
  `src/components/graph-skeleton.tsx`); table skeletons are one `h-5` bar per row inside the real
  table chrome.
- While a query is inside the grace period the real chart renders with empty data, so the frame
  is already warm when rows fade in.

## Rules

Do:

- Use the `graph-frame` family for any box or border.
- Keep corners square, colors semantic, and chrome labels mono uppercase. Use the terminal color
  grammar for graph glyphs and captions.

Don't:

- Rotate terminal hues for decoration, add unassigned color roles, use rounded cards, or place solid
  heavy borders where a dashed frame belongs.
- Draw charts with SVG or chart libraries — the glyph vocabulary (`GraphPlot`, `GraphRank`,
  `GraphStack`, …) is the chart language.
- Add loops or pulses beyond the march, or raw color values in components.

## Where things live

- Tokens and utilities: `src/styles.css` (theme block, `@utility` blocks, keyframes).
- Color themes: `src/themes/themes.css` + `src/themes/themes.ts` (generated by
  `scripts/generate-themes.ts`), `src/components/color-theme-picker.tsx`.
- Chart primitives: `src/components/graph-frame/`.
- Chrome: `src/components/header.tsx`, `footer.tsx`, `color-theme-picker.tsx`,
  `command-palette.tsx`, `graph-stat.tsx`, `src/components/ui/tabs.tsx`; the shell in
  `src/routes/__root.tsx`.
