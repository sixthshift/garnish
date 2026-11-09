# Design language

How garnish looks, and why. Six rules. The design system (`@sixthshift/design-system`) supplies the tokens and primitives and documents its own reasoning in `design-system/docs/` — this file records only what garnish decides on top, and where it diverges.

Compiled 2026-09-18 from screenshots of every page at 390px and 1440px, against the design system's `visual-hierarchy.md`, `density.md`, `design-philosophy.md` and `responsive.md`.

## 1. Two surfaces, and only two

- Page body is **base**: `bg-bg-subtle`. Set once, in `AppShell`.
- Anything holding the document's data is **elevated**: `Card` — tone, border and shadow together.
- In dark mode elevation is *lighter*, as in light: the page is the darkest surface (`earth-950`) and a card, sheet or menu sits half a step up (`earth-925`). Decision 139.
- A card never nests in a card. Group inside one with a rule, a heading or whitespace.
- Where the element cannot be a `<div>` — an `<li>` step, a `<button>` import source — borrow `cardVariants` from the primitive rather than restating the classes.

Base holds chrome, elevated holds data. The test: remove it, and if the page still works it is chrome.

| Chrome (base) | Data (elevated) |
|---|---|
| Page title, section labels, row counts | Ingredient list, step cards, notes |
| Search box, filter chips, sort and view toggles | Reference tables, style statements, aisles |
| Nav, week arrows, scale stepper | The plan's week, import source options, the editor's fields |

Decision 97. Before it the page and every card were the same tone, so nothing lifted.

## 2. A card contains data or is a target — never decoration

- **Data container:** the ingredient list, the reference table, the plan's week (one card, its seven days rows inside it; decision 141).
- **Target:** the three other ways in on `/recipes/new`, tiles across a desktop and rows on a phone, which take `cardVariants({ interactive: true })`; the web address above them is a card holding a form, not a target.
- **Not a card:** a sequence of rows inside a container; a control; a form field; an empty state.

A step is the deliberate exception — one card each, so the step being cooked can be marked as one (decision 66, surface refined by 97; row 214).

## 3. One density per page

The design system's three modes, assigned:

| Page | Mode |
|---|---|
| Recipe view, cook, editor, new | **Read** — one focus per viewport, generous padding |
| Recipes index, plan, shopping | **Scan** — rows with whitespace between groups |
| Settings reference tables | **Browse** — single-line rows, `text-sm`, minimal padding |

Mixing two on one surface is the "rhythm jolt" `density.md` exists to prevent. A page that needs both has two jobs.

## 4. One measure, one header

`src/components/Page.tsx` owns both, so a new page cannot invent a seventh width.

- `<Page>` — `max-w-6xl`, for content laid across the width.
- `<Page width="focus">` — `max-w-3xl`, for one column read top to bottom.
- `<PageHeader title actions>` — title left, actions right, wrapping on a phone.

The recipe page while cooked from is fullscreen and draws its own header line. Decision 98, row 214.

## 5. Colour is identity and state, nothing else

- **Brand** (teal: `#2c666c` fills in light, `#4ba5a9` in dark — the scale shipped as `emerald` and was always teal; decision 140) for the primary action only. Not emphasis, not decoration. A solid brand fill is each page's one primary action, or genuine state: a checked box or switch, a running timer, the focus ring. A primary action that cannot be pressed yet takes a neutral fill until it can.
- **Selected** is one look everywhere: the neutral tint's pressed step (`bg-bg-subtle-pressed`, `text-fg-normal`) — the nav's current place, a toggle segment, the view toggle, the Filters button while a filter is set, a style step's Keep or Original. Never brand. The design system's `Tabs` take it too, through one rule in `theme.css`.
- **Danger** for the confirmation step, not for the affordance that opens it — a red delete glyph on every row of an eight-row list makes delete the loudest thing on the page. Row removal is `intent="neutral"`. An affordance that destroys saved data at once and cannot be undone asks first (Clear ticked, a cook-log entry's Delete); one that only touches a draft, or whose result is redone in a tap or two (a step in the editor, a plan entry, a shopping line), is neutral and asks nothing. A red item *inside* a ⋯ menu is fine only when it then opens a confirm: the menu already hid it behind one press. A shopping row's swipe-left Delete is red for the same reason, and is itself the second step: the swipe hid it, and it shows on one row at a time (decisions.md row 187). Red is otherwise the confirm's alone.
- Warm earth neutrals carry all other hierarchy.
- **One illustration, one exception:** the pot an import or a restyle simmers in while it waits (`SimmerPot`) is drawn, not chrome, and its flames, their glow, a carrot's coin and two of its sparkles are amber. Nothing else takes amber but a warning.

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

- **Two-column recipe page.** The system's settled rule is single column, drill-in via routing. The recipe page keeps ingredients sticky beside the method on a desktop, and the print stylesheet depends on it. Decisions 99, 145 and 206.
- **Two experiences, not one stretched layout.** `responsive.md` names mobile / `sm:` / `lg:` as the adaptive vocabulary. Garnish, as expecting does, splits at the same 64rem but follows it two ways: `useLayout()` where the structure differs and the `mobile:` and `desktop:` variants where only the spacing does; there is no `md:` or `lg:` (decision 206, which replaces the old break at `md:` and decision 145's exception at `lg:`).
- **Three local components the system also ships.** `src/components/ui/` keeps its own `DataTable`, `NumberStepper` and `Markdown`, each built from the system's pieces, because the library's version does less than garnish needs (decision 180). `DataTable` adds row selection with a bulk Delete, search across every name a row answers to, a ⋯ menu per row, tap-to-open and a virtual list (rows 137, 174, 176, 177). `NumberStepper` takes decimals, 1.5 servings, where the library's is whole numbers only. `Markdown` is a parser with no HTML output and no `react-markdown`, and renders only what a step needs: paragraphs, lists, bold and italic. Anything else the system ships — `Steps` among them — is used as it is.

## Related

- [`decisions.md`](decisions.md) — rows 97, 98, 137, 141, 180, 206 and 207
- `design-system/docs/visual-hierarchy.md` — the surface system and the axes
- `design-system/docs/density.md` — the three density modes
