# Design language

How garnish looks, and why. Six rules. The design system (`@sixthshift/design-system`) supplies the tokens and primitives and documents its own reasoning in `design-system/docs/` — this file records only what garnish decides on top, and where it diverges.

Compiled 2026-09-18 from screenshots of every page at 390px and 1440px, against the design system's `visual-hierarchy.md`, `density.md`, `design-philosophy.md` and `responsive.md`.

## 1. Two surfaces, and only two

- Page body is **base**: `bg-bg-subtle`. Set once, in `AppShell`.
- Anything holding the document's data is **elevated**: `Card` — tone, border and shadow together.
- A card never nests in a card. Group inside one with a rule, a heading or whitespace.
- Where the element cannot be a `<div>` — an `<li>` step, a `<section>` plan day, a `<button>` import source — borrow `cardVariants` from the primitive rather than restating the classes.

Base holds chrome, elevated holds data. The test: remove it, and if the page still works it is chrome.

| Chrome (base) | Data (elevated) |
|---|---|
| Page title, section labels, row counts | Ingredient list, step cards, notes |
| Search box, filter chips, sort and view toggles | Reference tables, style statements, aisles |
| Nav, week arrows, scale stepper | Plan days, import source options, the editor's fields |

Decision 97. Before it the page and every card were the same tone, so nothing lifted.

## 2. A card contains data or is a target — never decoration

- **Data container:** the ingredient list, the reference table, a plan day.
- **Target:** the four `/recipes/new` options, which take `cardVariants({ interactive: true })` and are the one thing on that page you are meant to press.
- **Not a card:** a sequence of rows inside a container; a control; a form field; an empty state.

A step is the deliberate exception — one card each, because cook mode shows one at a time and shares the component (decision 66, surface refined by 97).

## 3. One density per page

The design system's three modes, assigned:

| Page | Mode |
|---|---|
| Recipe view, cook, editor, new | **Read** — one focus per viewport, generous padding |
| Recipes index, plan, shopping | **Scan** — rows with whitespace between groups |
| Settings reference tables | **Browse** — single-line rows, `text-sm`, minimal padding |

Mixing two on one surface is the "rhythm jolt" `density.md` exists to prevent. A page that needs both has two jobs.

## 4. One measure, one header

`src/components/shell/Page.tsx` owns both, so a new page cannot invent a seventh width.

- `<Page>` — `max-w-6xl`, for content laid across the width.
- `<Page width="focus">` — `max-w-3xl`, for one column read top to bottom.
- `<PageHeader title actions>` — title left, actions right, wrapping on a phone.

Cook mode is fullscreen and sets its own. Decision 98.

## 5. Colour is identity and state, nothing else

- **Brand** (emerald) for the primary action only. Not emphasis, not decoration.
- **Danger** for the confirmation step, not for the affordance that opens it — a red delete glyph on every row of an eight-row list makes delete the loudest thing on the page. Row removal is `intent="neutral"`.
- Warm earth neutrals carry all other hierarchy.

When two axes could say the same thing, use the quieter one: typography and whitespace before depth, depth before colour.

## 6. Phone first, and measured

- Every page fits 390px with no horizontal scroll. This is checkable, so check it: `document.documentElement.scrollWidth` against `window.innerWidth`.
- A table wider than the phone marks its optional columns `secondary: true` (hidden below `md`, still sorted and searched) rather than scrolling the page sideways.
- `overflow-x-auto` on a flex child needs `min-w-0`, or its automatic minimum width is the content's and the container grows instead of scrolling. This caused the settings table to widen the whole page.
- Nowrap controls in a narrow grid track need `min-w-0` on the track, or they are clipped by their own container. This caused the plan's add row to be cut off.
- Action rows wrap. Five nowrap buttons in the steps header pushed the editor 100px past the viewport.

## Typography

Set by the theme, listed here so the ramp is visible in one place:

- **Fraunces** — page and recipe titles. Identity.
- **Inter** — everything else.
- **JetBrains Mono** — the JSON editor.
- `SectionTitle` is the small-caps letterspaced label. Use the primitive; the editor had hand-rolled it as `Muted` + `uppercase tracking-wide` one type step smaller, in a different grey.

## Known divergences from the design system

Recorded so they are not silently "fixed":

- **Two-column recipe page.** The system's settled rule is single column, drill-in via routing. The recipe page keeps ingredients sticky beside the method, and the print stylesheet depends on it. Decision 99.
- **`md:` as the breakpoint.** `responsive.md` names mobile / `sm:` / `lg:` as the adaptive vocabulary and calls `md:` outside it. Garnish is phone-first with one break at `md:`, used throughout the shell and the recipe columns. Not worth churning; noted so the mismatch is known.

## Still open

- **The plan's seven-column week.** At `max-w-6xl` each day is ~185px, which no recipe name fits and which forced the add row's placeholder down to "Add a recipe". Decision 71's own reasoning ("seven days of a vertical list is the shape that fits the screen") argues for a list at every width; the calendar strip argues for the grid. Undecided.
- **Row actions in reference tables.** Every one of 85 food rows carries two text buttons, Merge and Edit. Decisions 54 and 65 put row actions in one `⋮` everywhere else; these tables predate that and were not revisited.
- **`data-theme` hydration mismatch.** The server renders without it and the client adds it, so React logs a mismatch on every page and the first paint can flash light. `bootstrapTheme()` runs in an effect; it needs to run before hydration.

## Related

- [`decisions.md`](decisions.md) — rows 97, 98, 99
- [`ui-gap.md`](ui-gap.md) — what garnish borrowed from Mealie and Tandoor, feature by feature
- `design-system/docs/visual-hierarchy.md` — the surface system and the axes
- `design-system/docs/density.md` — the three density modes
